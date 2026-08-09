-- ============================================
-- 029_security_hardening.sql
-- Cierre de las vulnerabilidades críticas de la auditoría 2026-07-15.
-- Idempotente: puede correrse más de una vez sin efectos colaterales.
--
-- Cubre:
--   #1  RPCs bot_*/sensibles abiertas a `authenticated` (y PUBLIC)  -> REVOKE
--   #2  OTP del paciente: contador de intentos que nunca persiste  -> reescritura
--       + código generado con random() (no CSPRNG)                 -> gen_random_bytes
--   #3  clinical_record_upsert puenteable con p_tenant_id = NULL    -> validación real
--   #4  2 vistas sin security_invoker (RLS evadida)                 -> ALTER VIEW
--
-- Las vulnerabilidades #5 (receipt IDOR), #6 (wompi-create-link sin auth)
-- y #7 (credenciales en repo) se arreglan fuera de SQL (Edge Functions + repo).
-- ============================================

-- ============================================================================
-- #1 — REVOKE de RPCs de uso EXCLUSIVO de n8n (service_role) que estaban
--      abiertas a cualquier usuario `authenticated`.
--
-- Se hace por nombre vía pg_proc para cubrir TODOS los overloads (p.ej.
-- bot_request_appointment de 8 y 9 args, resolve_inbound_phone de 1 y 2 args)
-- y para quitar además el EXECUTE implícito que PostgreSQL concede a PUBLIC.
-- Ninguna de estas funciones se invoca desde el frontend (verificado en src/).
-- ============================================================================
DO $$
DECLARE
  r RECORD;
  fn_names TEXT[] := ARRAY[
    'bot_recognize_patient', 'bot_upcoming_appointments', 'bot_upcoming_jornadas',
    'bot_active_services', 'bot_request_appointment', 'bot_request_reschedule',
    'bot_cancel_appointment', 'bot_register_lead', 'bot_escalate_to_human',
    'bot_get_recent_receipts', 'bot_list_doctors', 'resolve_inbound_phone',
    'upsert_whatsapp_conversation', 'recent_conversation_messages',
    'create_payment_intent', 'next_appointment_by_phone',
    'match_clinical_embeddings', 'schedule_appointment_reminders'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (fn_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    -- n8n usa service_role: garantizamos que conserve el acceso.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    RAISE NOTICE 'Hardened grants on %', r.sig;
  END LOOP;
END $$;

-- ============================================================================
-- #2 — OTP del paciente
--
-- Bug original (014_patient_sessions.sql):
--   (a) el chequeo usaba `v_otp.attempts` (copia local previa al UPDATE), y
--   (b) `RAISE EXCEPTION` en código incorrecto revertía la transacción de
--       PostgREST — y con ella el incremento del contador.
--   => el contador quedaba en 0 para siempre = fuerza bruta ilimitada del
--      código de 6 dígitos.
--
-- Arreglo:
--   - La función YA NO lanza excepción en los casos de fallo: RETORNA una fila
--     con success=false + error_code, de modo que el incremento del contador
--     HACE COMMIT.
--   - Se bloquea la fila del OTP con FOR UPDATE para serializar intentos
--     concurrentes, y se evalúa el valor FRESCO del contador (RETURNING).
--   - patient_otp_create genera el código con gen_random_bytes (CSPRNG).
--
-- Cambia el RETURNS de patient_otp_verify -> hay que DROP + CREATE.
-- La Edge Function patient-otp-verify se actualiza para leer success/error_code.
-- ============================================================================

-- --- 2a. patient_otp_create: CSPRNG en vez de random() ---------------------
CREATE OR REPLACE FUNCTION public.patient_otp_create(
  p_phone TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  code TEXT,
  expires_at TIMESTAMPTZ,
  patient_name TEXT,
  patient_exists BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone_normalized TEXT;
  v_recent_count INT;
  v_code TEXT;
  v_rand BYTEA;
  v_expires TIMESTAMPTZ;
  v_patient RECORD;
BEGIN
  v_phone_normalized := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF length(v_phone_normalized) < 10 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  -- Rate limiting: máx 5 OTPs por hora por teléfono
  SELECT COUNT(*) INTO v_recent_count
  FROM patient_otp_codes
  WHERE phone_normalized = v_phone_normalized
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera 1 hora.';
  END IF;

  SELECT p.id, p.full_name, p.tenant_id INTO v_patient
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || RIGHT(v_phone_normalized, 10)
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Código de 6 dígitos con RNG criptográfico (gen_random_bytes, no random()).
  -- 4 bytes -> 0..4_294_967_295, mod 1e6 => sesgo de módulo ~0.02% (irrelevante).
  v_rand := gen_random_bytes(4);
  v_code := LPAD(((
      get_byte(v_rand, 0)::BIGINT * 16777216
    + get_byte(v_rand, 1) * 65536
    + get_byte(v_rand, 2) * 256
    + get_byte(v_rand, 3)
  ) % 1000000)::TEXT, 6, '0');

  v_expires := NOW() + INTERVAL '10 minutes';

  UPDATE patient_otp_codes
  SET consumed_at = NOW()
  WHERE phone_normalized = v_phone_normalized
    AND consumed_at IS NULL;

  INSERT INTO patient_otp_codes (
    phone_normalized, code_hash, expires_at, ip_address, user_agent
  )
  VALUES (
    v_phone_normalized,
    encode(digest(v_code, 'sha256'), 'hex'),
    v_expires,
    p_ip,
    p_user_agent
  );

  RETURN QUERY SELECT
    v_code,
    v_expires,
    COALESCE(v_patient.full_name, ''),
    v_patient.id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_otp_create(TEXT, TEXT, TEXT) TO service_role;

-- --- 2b. patient_otp_verify: no revertir el contador -----------------------
DROP FUNCTION IF EXISTS public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.patient_otp_verify(
  p_phone TEXT,
  p_code TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  session_token TEXT,
  patient_id UUID,
  tenant_id UUID,
  patient_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone_normalized TEXT;
  v_code_hash TEXT;
  v_otp RECORD;
  v_new_attempts INT;
  v_patient RECORD;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_phone_normalized := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_code_hash := encode(digest(COALESCE(p_code, ''), 'sha256'), 'hex');

  -- Bloquea la fila del OTP activo: serializa intentos concurrentes.
  SELECT * INTO v_otp
  FROM patient_otp_codes
  WHERE phone_normalized = v_phone_normalized
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_otp.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'invalid_or_expired', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Incrementa y lee el valor FRESCO. Como la función RETORNA (no RAISE) en
  -- los caminos de fallo, este incremento HACE COMMIT.
  UPDATE patient_otp_codes
  SET attempts = attempts + 1
  WHERE id = v_otp.id
  RETURNING attempts INTO v_new_attempts;

  IF v_new_attempts > v_otp.max_attempts THEN
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RETURN QUERY SELECT FALSE, 'too_many_attempts', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_otp.code_hash <> v_code_hash THEN
    RETURN QUERY SELECT FALSE, 'wrong_code', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Código correcto: buscar paciente.
  SELECT p.id, p.full_name, p.tenant_id INTO v_patient
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || RIGHT(v_phone_normalized, 10)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_patient.id IS NULL THEN
    -- Consumir el OTP para evitar replay aunque no exista paciente.
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RETURN QUERY SELECT FALSE, 'no_patient', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := NOW() + INTERVAL '30 days';

  INSERT INTO patient_sessions (
    patient_id, tenant_id, token_hash, user_agent, ip_address, expires_at
  )
  VALUES (
    v_patient.id, v_patient.tenant_id, v_token_hash, p_user_agent, p_ip, v_expires
  );

  UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;

  RETURN QUERY SELECT
    TRUE, NULL::TEXT, v_token, v_patient.id, v_patient.tenant_id, v_patient.full_name, v_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================================================
-- #3 — clinical_record_upsert: cerrar el bypass de membresía
--
-- Bug original (017_clinical_records.sql:140): el guard era
--   `IF p_tenant_id IS NOT NULL AND NOT EXISTS(...)`  => con p_tenant_id = NULL
--   cualquier autenticado leía/sobrescribía historia clínica ajena pasando solo
--   un record_id. Además el camino de UPDATE nunca revalidaba el tenant real
--   del registro destino.
--
-- Arreglo:
--   - UPDATE: se resuelve el tenant REAL del registro (o de la cita) y se exige
--     membresía sobre ESE tenant.
--   - INSERT: tenant_id y patient_id obligatorios; se exige membresía sobre el
--     tenant y que el paciente (y la cita, si se da) pertenezcan a ese tenant.
--   Mantiene la firma -> CREATE OR REPLACE.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.clinical_record_upsert(
  p_record_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_subjective TEXT DEFAULT NULL,
  p_objective TEXT DEFAULT NULL,
  p_assessment TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_height_cm INT DEFAULT NULL,
  p_bp_systolic INT DEFAULT NULL,
  p_bp_diastolic INT DEFAULT NULL,
  p_heart_rate INT DEFAULT NULL,
  p_pain_points JSONB DEFAULT NULL,
  p_diagnosis_codes TEXT[] DEFAULT NULL
)
RETURNS clinical_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_record clinical_records%ROWTYPE;
  v_target_id UUID;
  v_target_tenant UUID;
  v_appt_tenant UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Resolver el registro destino (camino de UPDATE)
  IF p_record_id IS NOT NULL THEN
    SELECT id, tenant_id INTO v_target_id, v_target_tenant
    FROM clinical_records WHERE id = p_record_id;
    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'Registro no encontrado';
    END IF;
  ELSIF p_appointment_id IS NOT NULL THEN
    SELECT id, tenant_id INTO v_target_id, v_target_tenant
    FROM clinical_records
    WHERE appointment_id = p_appointment_id AND archived_at IS NULL
    LIMIT 1;
  END IF;

  IF v_target_id IS NOT NULL THEN
    -- UPDATE: membresía contra el tenant REAL del registro destino
    IF NOT EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = v_user AND tenant_id = v_target_tenant AND accepted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a este consultorio';
    END IF;

    UPDATE clinical_records SET
      subjective = COALESCE(p_subjective, subjective),
      objective = COALESCE(p_objective, objective),
      assessment = COALESCE(p_assessment, assessment),
      plan = COALESCE(p_plan, plan),
      weight_kg = COALESCE(p_weight_kg, weight_kg),
      height_cm = COALESCE(p_height_cm, height_cm),
      blood_pressure_systolic = COALESCE(p_bp_systolic, blood_pressure_systolic),
      blood_pressure_diastolic = COALESCE(p_bp_diastolic, blood_pressure_diastolic),
      heart_rate = COALESCE(p_heart_rate, heart_rate),
      pain_points = COALESCE(p_pain_points, pain_points),
      diagnosis_codes = COALESCE(p_diagnosis_codes, diagnosis_codes)
    WHERE id = v_target_id
    RETURNING * INTO v_record;
  ELSE
    -- INSERT: tenant + patient obligatorios y coherentes con la membresía
    IF p_tenant_id IS NULL OR p_patient_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id y patient_id son obligatorios al crear';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = v_user AND tenant_id = p_tenant_id AND accepted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION 'No tienes acceso a este consultorio';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM patients WHERE id = p_patient_id AND tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'El paciente no pertenece a este consultorio';
    END IF;

    IF p_appointment_id IS NOT NULL THEN
      SELECT tenant_id INTO v_appt_tenant FROM appointments WHERE id = p_appointment_id;
      IF v_appt_tenant IS NOT NULL AND v_appt_tenant <> p_tenant_id THEN
        RAISE EXCEPTION 'La cita no pertenece a este consultorio';
      END IF;
    END IF;

    INSERT INTO clinical_records (
      tenant_id, patient_id, appointment_id, doctor_id,
      subjective, objective, assessment, plan,
      weight_kg, height_cm,
      blood_pressure_systolic, blood_pressure_diastolic, heart_rate,
      pain_points, diagnosis_codes
    )
    VALUES (
      p_tenant_id, p_patient_id, p_appointment_id, v_user,
      p_subjective, p_objective, p_assessment, p_plan,
      p_weight_kg, p_height_cm,
      p_bp_systolic, p_bp_diastolic, p_heart_rate,
      COALESCE(p_pain_points, '[]'::jsonb),
      COALESCE(p_diagnosis_codes, '{}')
    )
    RETURNING * INTO v_record;
  END IF;

  RETURN v_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_record_upsert(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, INT, INT, INT, INT, JSONB, TEXT[]
) TO authenticated;

-- ============================================================================
-- #4 — Vistas sin security_invoker (RLS evadida)
--
-- Sin security_invoker una vista corre con los privilegios de SU DUEÑO, lo que
-- puentea la RLS de las tablas subyacentes. Ambas tablas base ya tienen RLS por
-- membresía (clinical_records: 017; tenant_subscriptions: 022), así que activar
-- security_invoker hace que la vista respete esas policies.
-- (PostgreSQL 15+; prod corre PG17.)
-- ============================================================================
ALTER VIEW public.patient_clinical_summary  SET (security_invoker = true);
ALTER VIEW public.tenant_current_subscription SET (security_invoker = true);
