-- ============================================
-- 016_patient_self_service.sql
-- Sprint 1.3 — Cierre del Panel del Paciente:
--   - Editar perfil propio (email, dirección, ciudad)
--   - Listar jornadas próximas con cupos disponibles
--   - Reservar lugar en una jornada (crea appointment automáticamente)
-- ============================================

-- ============================================
-- Schema: agregar jornada_id a appointments para vincular reservas
-- ============================================
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES jornadas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_jornada ON appointments(jornada_id) WHERE jornada_id IS NOT NULL;

-- ============================================
-- RPC: patient_update_profile
-- El paciente edita sus datos NO sensibles. NO puede cambiar phone (auth id).
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_update_profile(
  p_token TEXT,
  p_email TEXT DEFAULT NULL,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_email_clean TEXT;
BEGIN
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  -- Validar email si se envía
  IF p_email IS NOT NULL AND length(trim(p_email)) > 0 THEN
    v_email_clean := lower(trim(p_email));
    IF v_email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
      RAISE EXCEPTION 'Email inválido';
    END IF;
  ELSE
    v_email_clean := NULL;
  END IF;

  -- Update — solo campos permitidos
  UPDATE patients SET
    email = COALESCE(v_email_clean, email),
    address = COALESCE(NULLIF(trim(COALESCE(p_address, '')), ''), address),
    city = COALESCE(NULLIF(trim(COALESCE(p_city, '')), ''), city),
    updated_at = NOW()
  WHERE id = v_session.patient_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_update_profile(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================
-- RPC: patient_list_jornadas
-- Retorna jornadas próximas del tenant del paciente, con disponibilidad
-- y si ya tiene reserva en esa jornada.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_list_jornadas(
  p_token TEXT,
  p_limit INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_result JSON;
BEGIN
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.date ASC), '[]'::json)
  INTO v_result
  FROM (
    SELECT
      j.id,
      j.city,
      j.date,
      j.capacity,
      j.booked,
      (j.capacity - j.booked) AS available_spots,
      j.price_per_patient,
      j.notes,
      EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.jornada_id = j.id
          AND a.patient_id = v_session.patient_id
          AND a.status NOT IN ('cancelada', 'no_asistio')
      ) AS already_booked
    FROM jornadas j
    WHERE j.tenant_id = v_session.tenant_id
      AND j.date >= CURRENT_DATE
      AND j.status = 'programada'
    ORDER BY j.date ASC
    LIMIT p_limit
  ) t;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_list_jornadas(TEXT, INT) TO service_role;

-- ============================================
-- RPC: patient_book_jornada
-- Reserva un lugar en una jornada. Crea un appointment con type='jornada',
-- date=jornada.date, location=jornada.city. Incrementa jornadas.booked.
-- Notifica al doctor (owner del tenant) por WhatsApp.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_book_jornada(
  p_token TEXT,
  p_jornada_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_jornada jornadas%ROWTYPE;
  v_patient patients%ROWTYPE;
  v_appt_id UUID;
  v_doctor_id UUID;
  v_doctor_phone TEXT;
  v_doctor_name TEXT;
BEGIN
  -- 1. Sesión
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  -- 2. Jornada — lock para evitar race conditions en booked
  SELECT * INTO v_jornada FROM jornadas
  WHERE id = p_jornada_id AND tenant_id = v_session.tenant_id
  FOR UPDATE;

  IF v_jornada.id IS NULL THEN
    RAISE EXCEPTION 'Jornada no encontrada';
  END IF;

  IF v_jornada.status != 'programada' THEN
    RAISE EXCEPTION 'Esta jornada ya no acepta reservas';
  END IF;

  IF v_jornada.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Jornada pasada';
  END IF;

  IF v_jornada.booked >= v_jornada.capacity THEN
    RAISE EXCEPTION 'Esta jornada está llena';
  END IF;

  -- 3. Verificar que el paciente no tenga ya una reserva en esta jornada
  IF EXISTS (
    SELECT 1 FROM appointments
    WHERE jornada_id = p_jornada_id
      AND patient_id = v_session.patient_id
      AND status NOT IN ('cancelada', 'no_asistio')
  ) THEN
    RAISE EXCEPTION 'Ya tienes una reserva en esta jornada';
  END IF;

  -- 4. Cargar paciente para obtener nombre
  SELECT * INTO v_patient FROM patients WHERE id = v_session.patient_id;

  -- 5. Asignar doctor por defecto: owner del tenant
  SELECT user_id INTO v_doctor_id
  FROM tenant_memberships
  WHERE tenant_id = v_session.tenant_id AND role = 'owner'
  LIMIT 1;

  -- 6. Crear appointment
  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, assigned_doctor_id, jornada_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    v_session.tenant_id, v_session.patient_id, v_patient.full_name, v_doctor_id, p_jornada_id,
    v_jornada.date, '09:00'::TIME, 'jornada', v_jornada.city,
    'pendiente', v_jornada.price_per_patient,
    COALESCE(p_notes, '') || E'\n[Reservada en jornada vía panel del paciente]'
  )
  RETURNING id INTO v_appt_id;

  -- 7. Incrementar booked
  UPDATE jornadas SET booked = booked + 1 WHERE id = p_jornada_id;

  -- 8. Alerta CRM
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    v_session.tenant_id, 'info',
    'Nueva reserva en jornada ' || v_jornada.city || ' (' || v_jornada.date || '): ' || v_patient.full_name,
    'review_appointment', v_appt_id
  );

  -- 9. Notificar al doctor por WhatsApp
  IF v_doctor_id IS NOT NULL THEN
    SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
    FROM profiles p WHERE p.id = v_doctor_id;

    IF v_doctor_phone IS NOT NULL THEN
      INSERT INTO notification_jobs (
        tenant_id, patient_id, appointment_id, channel, template_key,
        scheduled_for, recipient_phone, recipient_user_id, payload
      )
      VALUES (
        v_session.tenant_id, v_session.patient_id, v_appt_id,
        'whatsapp', 'doctor_jornada_booking',
        NOW() + INTERVAL '5 seconds',
        regexp_replace(v_doctor_phone, '\D', '', 'g'),
        v_doctor_id,
        jsonb_build_object(
          'doctor_first_name', split_part(COALESCE(v_doctor_name, ''), ' ', 2),
          'patient_name', v_patient.full_name,
          'jornada_city', v_jornada.city,
          'jornada_date', v_jornada.date,
          'available_spots', v_jornada.capacity - v_jornada.booked - 1
        )
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'appointment_id', v_appt_id,
    'jornada_city', v_jornada.city,
    'jornada_date', v_jornada.date
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_book_jornada(TEXT, UUID, TEXT) TO service_role;
