-- ============================================
-- 013_doctor_assignment.sql
-- - Asignación de cita a un doctor específico
-- - Notificación a teléfono distinto al del paciente (para alertar al doctor)
-- - RPCs nuevas: list_doctors, request_appointment con doctor
-- ============================================

-- Columnas nuevas
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS assigned_doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(assigned_doctor_id, date);

-- notification_jobs: permitir destinatario distinto al paciente
ALTER TABLE notification_jobs
  ADD COLUMN IF NOT EXISTS recipient_phone TEXT,
  ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================
-- TOOL: bot_list_doctors
-- Lista doctores activos del consultorio (owner + doctores)
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_list_doctors(p_tenant_id UUID)
RETURNS TABLE (
  doctor_id UUID,
  full_name TEXT,
  role TEXT,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    m.role,
    p.phone
  FROM tenant_memberships m
  JOIN profiles p ON p.id = m.user_id
  WHERE m.tenant_id = p_tenant_id
    AND m.role IN ('owner', 'doctor')
    AND m.accepted_at IS NOT NULL
  ORDER BY
    CASE m.role WHEN 'owner' THEN 1 WHEN 'doctor' THEN 2 ELSE 3 END,
    p.full_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_list_doctors(UUID) TO service_role, authenticated;

-- ============================================
-- TOOL actualizado: bot_request_appointment ahora acepta p_doctor_id
-- y crea notification_job para AVISAR al doctor
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_request_appointment(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_patient_name TEXT,
  p_date DATE,
  p_time TIME,
  p_type TEXT,
  p_location TEXT DEFAULT 'consultorio',
  p_notes TEXT DEFAULT NULL,
  p_doctor_id UUID DEFAULT NULL
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
BEGIN
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede agendar en fechas pasadas';
  END IF;

  v_price := CASE p_type
    WHEN 'primera_consulta' THEN 150000
    WHEN 'seguimiento' THEN 100000
    WHEN 'jornada' THEN 150000
    WHEN 'emergencia' THEN 200000
    ELSE 100000
  END;

  -- Si no se especifica doctor, asignar al owner del tenant
  IF p_doctor_id IS NULL THEN
    SELECT user_id INTO p_doctor_id
    FROM tenant_memberships
    WHERE tenant_id = p_tenant_id AND role = 'owner'
    LIMIT 1;
  END IF;

  -- Obtener teléfono del doctor para notificación
  SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
  FROM profiles p WHERE p.id = p_doctor_id;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, assigned_doctor_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    p_tenant_id, p_patient_id, p_patient_name, p_doctor_id,
    p_date, p_time, p_type, COALESCE(p_location, 'consultorio'),
    'pendiente', v_price,
    COALESCE(p_notes, '') || ' [Solicitada vía WhatsApp]'
  )
  RETURNING * INTO v_appt;

  -- Alerta para recepción
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    p_tenant_id, 'info',
    'Nueva cita solicitada por WhatsApp: ' || p_patient_name || ' con ' ||
    COALESCE(v_doctor_name, 'doctor') || ' para ' || p_date,
    'review_appointment', v_appt.id
  );

  -- Notificar al DOCTOR vía WhatsApp (si tiene teléfono)
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
        'doctor_first_name', split_part(v_doctor_name, ' ', 2), -- "Dr. Miguel" → "Miguel"
        'patient_name', p_patient_name,
        'appointment_date', p_date,
        'appointment_time', p_time,
        'appointment_type', p_type,
        'type_label', CASE p_type
          WHEN 'primera_consulta' THEN 'Primera consulta'
          WHEN 'seguimiento' THEN 'Seguimiento'
          WHEN 'jornada' THEN 'Jornada'
          WHEN 'emergencia' THEN 'Emergencia'
          ELSE p_type
        END,
        'location', COALESCE(p_location, 'consultorio')
      )
    );
  END IF;

  RETURN v_appt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_request_appointment(UUID, UUID, TEXT, DATE, TIME, TEXT, TEXT, TEXT, UUID) TO service_role, authenticated;

-- ============================================
-- RPC mejorado: notification_jobs_due ahora retorna también recipient_phone
-- (la función original ya retorna SETOF notification_jobs, así que solo
-- necesitamos asegurar que el cron use recipient_phone si existe)
-- ============================================
-- (Ya existe notification_jobs_due — el cron lo va a leer con todos los campos
--  de notification_jobs incluyendo los nuevos recipient_phone y recipient_user_id)

-- ============================================
-- TOOL: bot_upcoming_appointments_with_doctor
-- Versión mejorada que incluye nombre del doctor asignado
-- ============================================
DROP FUNCTION IF EXISTS public.bot_upcoming_appointments(TEXT, INT);

CREATE OR REPLACE FUNCTION public.bot_upcoming_appointments(p_phone TEXT, p_limit INT DEFAULT 3)
RETURNS TABLE (
  appointment_id UUID,
  appointment_date DATE,
  appointment_time TIME,
  appointment_type TEXT,
  type_label TEXT,
  location TEXT,
  status TEXT,
  price BIGINT,
  doctor_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');

  RETURN QUERY
  SELECT a.id, a.date, a.time, a.type,
    CASE a.type
      WHEN 'primera_consulta' THEN 'Primera consulta'
      WHEN 'seguimiento' THEN 'Seguimiento'
      WHEN 'jornada' THEN 'Jornada'
      WHEN 'emergencia' THEN 'Emergencia'
      ELSE a.type
    END,
    a.location,
    a.status,
    a.price,
    COALESCE(prof.full_name, 'Por asignar')
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  LEFT JOIN profiles prof ON prof.id = a.assigned_doctor_id
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
    AND a.date >= CURRENT_DATE
    AND a.status IN ('pendiente', 'confirmada')
  ORDER BY a.date ASC, a.time ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_upcoming_appointments(TEXT, INT) TO service_role, authenticated;
