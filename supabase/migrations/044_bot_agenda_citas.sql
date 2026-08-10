-- ============================================
-- 044_bot_agenda_citas.sql
-- El bot no podía agendar: la RPC no existía con la firma que él llamaba
--
-- SÍNTOMA
-- Un paciente pidió cita por WhatsApp y el bot contestó «Hubo un inconveniente
-- al registrar su cita». La herramienta `agendar_cita_pendiente` recibía de
-- PostgREST un **404**.
--
-- CAUSA (tres capas, todas reales)
--
-- 1. La herramienta envía DIEZ parámetros, incluido `p_patient_phone`, y
--    NINGUNA versión de `bot_request_appointment` lo acepta. PostgREST no
--    encuentra función que encaje y responde 404 — no es que fallara la
--    inserción: nunca llegó a ejecutarse nada.
--
-- 2. La función estaba DUPLICADA (8 y 9 parámetros). Es el mismo patrón que
--    tumbó los cobros con Bold (migración 039): dos sobrecargas con prefijo
--    común hacen que PostgREST no pueda resolver a cuál llamar.
--
-- 3. Los precios estaban quemados otra vez aquí dentro (150.000 la primera
--    consulta, 100.000 el seguimiento). La migración 041 los sacó del código
--    del frontend y los puso en `tenants.appointment_prices`, pero esta
--    función seguía con los viejos: una cita agendada por el bot nacía con la
--    tarifa equivocada.
--
-- Y algo que faltaba de raíz: `appointments` no tenía dónde guardar el
-- teléfono. Si el bot agenda a alguien que todavía no es paciente, el
-- consultorio se queda con un nombre y sin forma de llamarlo.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/044_bot_agenda_citas.sql
-- ============================================

-- ── 1. Dónde guardar el contacto de quien aún no es paciente ────────────────
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_phone TEXT;

COMMENT ON COLUMN public.appointments.patient_phone IS
  'Teléfono de contacto cuando la cita llega por WhatsApp y todavía no hay ficha de paciente.';

-- ── 2. Fuera la sobrecarga vieja ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.bot_request_appointment(
  UUID, UUID, TEXT, DATE, TIME, TEXT, TEXT, TEXT
);
DROP FUNCTION IF EXISTS public.bot_request_appointment(
  UUID, UUID, TEXT, DATE, TIME, TEXT, TEXT, TEXT, UUID
);

-- ── 3. Una sola función, con teléfono y con las tarifas del consultorio ─────
CREATE FUNCTION public.bot_request_appointment(
  p_tenant_id     UUID,
  p_patient_id    UUID,
  p_patient_name  TEXT,
  p_date          DATE,
  p_time          TIME,
  p_type          TEXT,
  p_location      TEXT DEFAULT 'consultorio',
  p_notes         TEXT DEFAULT NULL,
  p_doctor_id     UUID DEFAULT NULL,
  p_patient_phone TEXT DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_appt appointments%ROWTYPE;
  v_price BIGINT;
  v_doctor_phone TEXT;
  v_doctor_name TEXT;
  v_phone TEXT;
BEGIN
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede agendar en fechas pasadas';
  END IF;

  -- La tarifa sale de lo que el consultorio configuró en Ajustes → Tarifas.
  -- Si no ha configurado nada, se usan los valores de fábrica, que son los
  -- mismos que trae el frontend en utils/format.js. Un solo sitio manda.
  SELECT NULLIF(t.appointment_prices ->> p_type, '')::BIGINT
    INTO v_price
  FROM tenants t WHERE t.id = p_tenant_id;

  IF v_price IS NULL OR v_price < 0 THEN
    v_price := CASE p_type
      WHEN 'primera_consulta' THEN 175000
      WHEN 'seguimiento'      THEN 175000
      WHEN 'jornada'          THEN 175000
      WHEN 'emergencia'       THEN 200000
      ELSE 175000
    END;
  END IF;

  -- Sin doctor indicado, se asigna al dueño del consultorio.
  IF p_doctor_id IS NULL THEN
    SELECT user_id INTO p_doctor_id
    FROM tenant_memberships
    WHERE tenant_id = p_tenant_id AND role = 'owner'
    LIMIT 1;
  END IF;

  SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
  FROM profiles p WHERE p.id = p_doctor_id;

  -- Mismo criterio de normalización que el resto del sistema.
  v_phone := regexp_replace(COALESCE(p_patient_phone, ''), '\D', '', 'g');
  IF length(v_phone) = 10 THEN v_phone := '57' || v_phone; END IF;
  IF v_phone = '' THEN v_phone := NULL; END IF;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, patient_phone, assigned_doctor_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    p_tenant_id, p_patient_id, p_patient_name, v_phone, p_doctor_id,
    p_date, p_time, p_type, COALESCE(p_location, 'consultorio'),
    'pendiente', v_price,
    COALESCE(p_notes, '') || ' [Solicitada vía WhatsApp]'
  )
  RETURNING * INTO v_appt;

  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    p_tenant_id, 'info',
    'Nueva cita solicitada por WhatsApp: ' || p_patient_name || ' con ' ||
    COALESCE(v_doctor_name, 'doctor') || ' para ' || p_date,
    'review_appointment', v_appt.id
  );

  IF v_doctor_phone IS NOT NULL THEN
    INSERT INTO notification_jobs (
      tenant_id, patient_id, appointment_id, channel, template_key,
      scheduled_for, recipient_phone, recipient_user_id, payload
    )
    VALUES (
      p_tenant_id, p_patient_id, v_appt.id, 'whatsapp', 'doctor_new_appointment',
      NOW() + INTERVAL '10 seconds',
      regexp_replace(v_doctor_phone, '\D', '', 'g'),
      p_doctor_id,
      jsonb_build_object(
        'doctor_first_name', split_part(v_doctor_name, ' ', 2),
        'patient_name', p_patient_name,
        'patient_phone', v_phone,
        'appointment_date', p_date,
        'appointment_time', p_time,
        'appointment_type', p_type,
        'type_label', CASE p_type
          WHEN 'primera_consulta' THEN 'Primera consulta'
          WHEN 'seguimiento'      THEN 'Seguimiento'
          WHEN 'jornada'          THEN 'Jornada'
          WHEN 'emergencia'       THEN 'Emergencia'
          ELSE p_type
        END,
        'location', COALESCE(p_location, 'consultorio')
      )
    );
  END IF;

  RETURN v_appt;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bot_request_appointment(UUID,UUID,TEXT,DATE,TIME,TEXT,TEXT,TEXT,UUID,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.bot_request_appointment(UUID,UUID,TEXT,DATE,TIME,TEXT,TEXT,TEXT,UUID,TEXT) TO service_role;

-- ── Comprobación: exactamente una, y que acepte el teléfono ─────────────────
DO $$
DECLARE v_n INT; v_args TEXT;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bot_request_appointment';

  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 bot_request_appointment, hay %', v_n;
  END IF;

  SELECT pg_get_function_identity_arguments(p.oid) INTO v_args FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bot_request_appointment';

  IF v_args NOT LIKE '%p_patient_phone%' THEN
    RAISE EXCEPTION 'La función no acepta p_patient_phone: %', v_args;
  END IF;
END $$;
