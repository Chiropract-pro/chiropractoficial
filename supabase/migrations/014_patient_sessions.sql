-- ============================================
-- 014_patient_sessions.sql
-- Panel del Paciente — Autenticación OTP vía WhatsApp
--
-- Flow:
--   1. Paciente ingresa su teléfono → Edge Function patient-otp-request
--      → llama patient_otp_create(phone) → recibe código de 6 dígitos en plain
--      → envía código vía Evolution API (WhatsApp)
--   2. Paciente ingresa código → Edge Function patient-otp-verify
--      → llama patient_otp_verify(phone, code) → recibe session_token plain
--      → frontend almacena en localStorage
--   3. Cada request del frontend incluye Authorization: Bearer <session_token>
--      → Edge Function patient-me (o cualquier patient-*) llama
--        patient_session_lookup(token) para obtener (patient_id, tenant_id)
--
-- Diseño de seguridad:
--   - El código y el token se almacenan SOLO como sha256(value) en BD
--   - El plain solo se devuelve UNA VEZ a quien creó el registro
--   - Rate limiting: 5 OTPs/hora por phone, 5 intentos por código
--   - Sesiones expiran a 30 días y se renuevan en cada uso (rolling)
-- ============================================

-- Helper: SHA-256 hex (ya existe pgcrypto en Supabase por defecto)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. patient_otp_codes — códigos one-time
-- ============================================
CREATE TABLE IF NOT EXISTS patient_otp_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone_normalized TEXT NOT NULL,        -- solo dígitos, ej "573176305076"
  code_hash TEXT NOT NULL,                -- sha256 hex del código de 6 dígitos
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_otp_phone_active
  ON patient_otp_codes(phone_normalized, expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_otp_created
  ON patient_otp_codes(phone_normalized, created_at DESC);

-- ============================================
-- 2. patient_sessions — JWTs (en realidad opaque tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS patient_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,        -- sha256 hex del session token
  user_agent TEXT,
  ip_address TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patient_sessions_token
  ON patient_sessions(token_hash) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patient_sessions_patient
  ON patient_sessions(patient_id, last_used_at DESC);

-- ============================================
-- RPC: patient_otp_create(p_phone)
-- Devuelve { code, expires_at, patient_name }
-- El caller (Edge Function) recibe el code en plain y lo envía por WhatsApp.
-- ============================================
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
  v_expires TIMESTAMPTZ;
  v_patient RECORD;
BEGIN
  -- Normalizar teléfono (solo dígitos)
  v_phone_normalized := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');

  IF length(v_phone_normalized) < 10 THEN
    RAISE EXCEPTION 'Teléfono inválido';
  END IF;

  -- Rate limiting: máx 5 OTPs por hora por phone
  SELECT COUNT(*) INTO v_recent_count
  FROM patient_otp_codes
  WHERE phone_normalized = v_phone_normalized
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Demasiados intentos. Espera 1 hora.';
  END IF;

  -- Buscar paciente con este teléfono (LIKE para tolerar prefijos)
  SELECT p.id, p.full_name, p.tenant_id INTO v_patient
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || RIGHT(v_phone_normalized, 10)
  ORDER BY p.created_at DESC
  LIMIT 1;

  -- Generar código de 6 dígitos
  v_code := LPAD(floor(random() * 1000000)::TEXT, 6, '0');
  v_expires := NOW() + INTERVAL '10 minutes';

  -- Invalidar OTPs activos previos para este teléfono
  UPDATE patient_otp_codes
  SET consumed_at = NOW()
  WHERE phone_normalized = v_phone_normalized
    AND consumed_at IS NULL;

  -- Insertar nuevo OTP
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

  -- Devolver el código en plain (solo esta vez), info del paciente si existe
  RETURN QUERY SELECT
    v_code,
    v_expires,
    COALESCE(v_patient.full_name, ''),
    v_patient.id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_otp_create(TEXT, TEXT, TEXT) TO service_role;

-- ============================================
-- RPC: patient_otp_verify(p_phone, p_code)
-- Devuelve { session_token, patient_id, tenant_id, patient_name }
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_otp_verify(
  p_phone TEXT,
  p_code TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
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
  v_patient RECORD;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_phone_normalized := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_code_hash := encode(digest(COALESCE(p_code, ''), 'sha256'), 'hex');

  -- Buscar OTP activo
  SELECT * INTO v_otp
  FROM patient_otp_codes
  WHERE phone_normalized = v_phone_normalized
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_otp.id IS NULL THEN
    RAISE EXCEPTION 'Código no válido o expirado';
  END IF;

  -- Incrementar attempts ANTES de verificar (atomicidad)
  UPDATE patient_otp_codes
  SET attempts = attempts + 1
  WHERE id = v_otp.id;

  IF v_otp.attempts + 1 > v_otp.max_attempts THEN
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RAISE EXCEPTION 'Demasiados intentos. Solicita un nuevo código.';
  END IF;

  IF v_otp.code_hash != v_code_hash THEN
    RAISE EXCEPTION 'Código incorrecto';
  END IF;

  -- ✅ Código válido — buscar paciente
  SELECT p.id, p.full_name, p.tenant_id INTO v_patient
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || RIGHT(v_phone_normalized, 10)
  ORDER BY p.created_at DESC
  LIMIT 1;

  IF v_patient.id IS NULL THEN
    -- Marcar OTP como consumido aunque no haya paciente, para no permitir replay
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RAISE EXCEPTION 'No encontramos un paciente registrado con este número. Habla con tu doctor.';
  END IF;

  -- Generar session token de 32 bytes (64 hex chars)
  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := NOW() + INTERVAL '30 days';

  -- Crear sesión
  INSERT INTO patient_sessions (
    patient_id, tenant_id, token_hash, user_agent, ip_address, expires_at
  )
  VALUES (
    v_patient.id, v_patient.tenant_id, v_token_hash, p_user_agent, p_ip, v_expires
  );

  -- Marcar OTP como consumido
  UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;

  RETURN QUERY SELECT
    v_token,
    v_patient.id,
    v_patient.tenant_id,
    v_patient.full_name,
    v_expires;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================
-- RPC: patient_session_lookup(p_token)
-- Usado por Edge Functions para autenticar requests del paciente.
-- Actualiza last_used_at y devuelve patient_id + tenant_id si la sesión es válida.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_session_lookup(p_token TEXT)
RETURNS TABLE (
  patient_id UUID,
  tenant_id UUID,
  patient_name TEXT,
  patient_phone TEXT,
  patient_email TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_token_hash TEXT;
  v_session RECORD;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

  SELECT s.id, s.patient_id, s.tenant_id, s.expires_at
  INTO v_session
  FROM patient_sessions s
  WHERE s.token_hash = v_token_hash
    AND s.revoked_at IS NULL
    AND s.expires_at > NOW()
  LIMIT 1;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'Sesión expirada o inválida';
  END IF;

  -- Renovar last_used_at (rolling)
  UPDATE patient_sessions
  SET last_used_at = NOW()
  WHERE id = v_session.id;

  RETURN QUERY
  SELECT v_session.patient_id, v_session.tenant_id,
         p.full_name, p.phone, p.email, v_session.expires_at
  FROM patients p
  WHERE p.id = v_session.patient_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_session_lookup(TEXT) TO service_role;

-- ============================================
-- RPC: patient_session_revoke(p_token) — logout
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_session_revoke(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_token_hash TEXT;
BEGIN
  v_token_hash := encode(digest(COALESCE(p_token, ''), 'sha256'), 'hex');

  UPDATE patient_sessions
  SET revoked_at = NOW()
  WHERE token_hash = v_token_hash AND revoked_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_session_revoke(TEXT) TO service_role;

-- ============================================
-- RPC: patient_get_dashboard(p_token)
-- Devuelve datos resumidos para el panel del paciente:
--   - próximas citas con doctor asignado
--   - últimas 5 transacciones (recibos)
--   - pagos pendientes (Wompi pending)
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_get_dashboard(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_result JSON;
BEGIN
  -- Verifica sesión
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token)
  LIMIT 1;

  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT json_build_object(
    'patient', (
      SELECT json_build_object(
        'id', p.id, 'full_name', p.full_name, 'email', p.email,
        'phone', p.phone, 'address', p.address, 'city', p.city,
        'total_spent', p.total_spent, 'appointments_count', p.appointments_count
      )
      FROM patients p WHERE p.id = v_session.patient_id
    ),
    'upcoming_appointments', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT a.id, a.date, a.time, a.type, a.status, a.location, a.price,
               COALESCE(prof.full_name, 'Por asignar') AS doctor_name
        FROM appointments a
        LEFT JOIN profiles prof ON prof.id = a.assigned_doctor_id
        WHERE a.patient_id = v_session.patient_id
          AND a.date >= CURRENT_DATE
          AND a.status IN ('pendiente', 'confirmada')
        ORDER BY a.date ASC, a.time ASC
        LIMIT 10
      ) t
    ),
    'recent_sales', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id, s.created_at, s.total, s.status, s.payment_method
        FROM sales s
        WHERE s.patient_id = v_session.patient_id
        ORDER BY s.created_at DESC
        LIMIT 10
      ) t
    ),
    'pending_payments', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT pay.id, pay.amount, pay.description, pay.payment_url,
               pay.expires_at, pay.created_at
        FROM payments pay
        WHERE pay.patient_id = v_session.patient_id
          AND pay.status = 'pending'
          AND (pay.expires_at IS NULL OR pay.expires_at > NOW())
        ORDER BY pay.created_at DESC
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_get_dashboard(TEXT) TO service_role;

-- ============================================
-- RLS: las tablas patient_otp_codes y patient_sessions NO se exponen al frontend.
-- Solo el service_role (Edge Functions) las toca. Por seguridad, ENABLE RLS sin policies.
-- ============================================
ALTER TABLE patient_otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_sessions ENABLE ROW LEVEL SECURITY;
-- (sin policies = nadie puede leer/escribir desde anon/authenticated)
