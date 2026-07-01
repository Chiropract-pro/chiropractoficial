-- ============================================
-- 015_patient_actions.sql
-- Sprint 1.2 — Acciones del paciente sobre sus propios datos:
--   - Cancelar cita futura
--   - Solicitar reagendamiento (no aprueba — el doctor confirma)
--   - Ver detalle de un recibo (sale + items + payment)
--
-- Todas validan la sesión OTP via patient_session_lookup.
-- Todas crean alertas en el CRM y notifican al doctor por WhatsApp.
-- ============================================

-- ============================================
-- Tabla: appointment_change_requests
-- Bandeja de entrada de cambios solicitados por el paciente.
-- El doctor las ve en su dashboard y aprueba/rechaza.
-- ============================================
CREATE TABLE IF NOT EXISTS appointment_change_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('reschedule', 'cancel')),
  proposed_date DATE,
  proposed_time TIME,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_applied')),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_change_requests_tenant_status
  ON appointment_change_requests(tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_requests_appointment
  ON appointment_change_requests(appointment_id);

ALTER TABLE appointment_change_requests ENABLE ROW LEVEL SECURITY;

-- Policy: solo miembros del tenant pueden ver/editar
DROP POLICY IF EXISTS "tenant_members_change_requests" ON appointment_change_requests;
CREATE POLICY "tenant_members_change_requests"
  ON appointment_change_requests
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- ============================================
-- RPC: patient_cancel_appointment
-- El paciente cancela su propia cita futura.
-- Cambia status='cancelada' DIRECTAMENTE (no requiere aprobación del doctor).
-- Pero crea una entrada en appointment_change_requests con status='auto_applied'
-- para auditoría y para que el doctor lo vea en su feed.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_cancel_appointment(
  p_token TEXT,
  p_appointment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_appt appointments%ROWTYPE;
  v_doctor_phone TEXT;
  v_doctor_name TEXT;
  v_doctor_id UUID;
BEGIN
  -- 1. Verifica sesión
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  -- 2. Carga la cita y valida ownership
  SELECT * INTO v_appt FROM appointments
  WHERE id = p_appointment_id AND patient_id = v_session.patient_id;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  -- 3. Validaciones de negocio
  IF v_appt.status IN ('cancelada', 'completada', 'no_asistio') THEN
    RAISE EXCEPTION 'Esta cita ya está cerrada';
  END IF;

  IF v_appt.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No puedes cancelar citas pasadas. Llama al consultorio.';
  END IF;

  -- Política: pedir cancelar con menos de 4h de anticipación requiere llamar al consultorio
  IF v_appt.date = CURRENT_DATE
     AND (v_appt.time - CURRENT_TIME) < INTERVAL '4 hours' THEN
    RAISE EXCEPTION 'Para cancelar con menos de 4 horas, por favor llama al consultorio.';
  END IF;

  -- 4. Cancela la cita
  UPDATE appointments SET
    status = 'cancelada',
    notes = COALESCE(notes, '') ||
            E'\n[Cancelada por el paciente vía panel ' || NOW()::DATE || ']' ||
            COALESCE(' Motivo: ' || p_reason, '')
  WHERE id = p_appointment_id;

  -- 5. Audit en appointment_change_requests
  INSERT INTO appointment_change_requests (
    tenant_id, appointment_id, patient_id,
    request_type, reason, status, resolved_at
  )
  VALUES (
    v_session.tenant_id, p_appointment_id, v_session.patient_id,
    'cancel', p_reason, 'auto_applied', NOW()
  );

  -- 6. Alerta para recepción
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    v_session.tenant_id, 'warning',
    'Paciente canceló cita: ' || v_appt.patient_name ||
    ' del ' || v_appt.date || ' ' || v_appt.time ||
    COALESCE(' (motivo: ' || p_reason || ')', ''),
    'review_appointment', p_appointment_id
  );

  -- 7. Notifica al doctor por WhatsApp si tiene phone
  v_doctor_id := v_appt.assigned_doctor_id;
  IF v_doctor_id IS NOT NULL THEN
    SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
    FROM profiles p WHERE p.id = v_doctor_id;

    IF v_doctor_phone IS NOT NULL THEN
      INSERT INTO notification_jobs (
        tenant_id, patient_id, appointment_id, channel, template_key,
        scheduled_for, recipient_phone, recipient_user_id, payload
      )
      VALUES (
        v_session.tenant_id, v_session.patient_id, p_appointment_id,
        'whatsapp', 'doctor_appointment_cancelled',
        NOW() + INTERVAL '5 seconds',
        regexp_replace(v_doctor_phone, '\D', '', 'g'),
        v_doctor_id,
        jsonb_build_object(
          'doctor_first_name', split_part(COALESCE(v_doctor_name, ''), ' ', 2),
          'patient_name', v_appt.patient_name,
          'appointment_date', v_appt.date,
          'appointment_time', v_appt.time,
          'reason', COALESCE(p_reason, 'No especificado')
        )
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'appointment_id', p_appointment_id,
    'status', 'cancelada'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_cancel_appointment(TEXT, UUID, TEXT) TO service_role;

-- ============================================
-- RPC: patient_request_reschedule
-- El paciente propone una nueva fecha/hora. NO cambia la cita —
-- crea un appointment_change_request con status='pending' para que el doctor confirme.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_request_reschedule(
  p_token TEXT,
  p_appointment_id UUID,
  p_preferred_date DATE,
  p_preferred_time TIME,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_appt appointments%ROWTYPE;
  v_request_id UUID;
  v_doctor_phone TEXT;
  v_doctor_name TEXT;
  v_existing_pending INT;
BEGIN
  -- 1. Verifica sesión
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  -- 2. Cita
  SELECT * INTO v_appt FROM appointments
  WHERE id = p_appointment_id AND patient_id = v_session.patient_id;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  IF v_appt.status IN ('cancelada', 'completada', 'no_asistio') THEN
    RAISE EXCEPTION 'Esta cita ya está cerrada';
  END IF;

  -- 3. Validar fecha propuesta
  IF p_preferred_date IS NULL OR p_preferred_time IS NULL THEN
    RAISE EXCEPTION 'Indica la nueva fecha y hora';
  END IF;

  IF p_preferred_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'La fecha propuesta debe ser futura';
  END IF;

  -- 4. Anti-spam: si ya hay un request pendiente para esta cita, dejarlo idempotente
  SELECT COUNT(*) INTO v_existing_pending
  FROM appointment_change_requests
  WHERE appointment_id = p_appointment_id
    AND request_type = 'reschedule'
    AND status = 'pending';

  IF v_existing_pending > 0 THEN
    RAISE EXCEPTION 'Ya tienes una solicitud pendiente para esta cita. Espera la respuesta del consultorio.';
  END IF;

  -- 5. Crear el request
  INSERT INTO appointment_change_requests (
    tenant_id, appointment_id, patient_id,
    request_type, proposed_date, proposed_time, reason, status
  )
  VALUES (
    v_session.tenant_id, p_appointment_id, v_session.patient_id,
    'reschedule', p_preferred_date, p_preferred_time, p_notes, 'pending'
  )
  RETURNING id INTO v_request_id;

  -- 6. Alerta CRM
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    v_session.tenant_id, 'info',
    'Paciente solicita reagendar: ' || v_appt.patient_name ||
    ' — propuesto ' || p_preferred_date || ' ' || p_preferred_time,
    'review_change_request', v_request_id
  );

  -- 7. Notifica al doctor
  IF v_appt.assigned_doctor_id IS NOT NULL THEN
    SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
    FROM profiles p WHERE p.id = v_appt.assigned_doctor_id;

    IF v_doctor_phone IS NOT NULL THEN
      INSERT INTO notification_jobs (
        tenant_id, patient_id, appointment_id, channel, template_key,
        scheduled_for, recipient_phone, recipient_user_id, payload
      )
      VALUES (
        v_session.tenant_id, v_session.patient_id, p_appointment_id,
        'whatsapp', 'doctor_reschedule_request',
        NOW() + INTERVAL '5 seconds',
        regexp_replace(v_doctor_phone, '\D', '', 'g'),
        v_appt.assigned_doctor_id,
        jsonb_build_object(
          'doctor_first_name', split_part(COALESCE(v_doctor_name, ''), ' ', 2),
          'patient_name', v_appt.patient_name,
          'old_date', v_appt.date,
          'old_time', v_appt.time,
          'new_date', p_preferred_date,
          'new_time', p_preferred_time,
          'notes', COALESCE(p_notes, '')
        )
      );
    END IF;
  END IF;

  RETURN json_build_object(
    'ok', true,
    'request_id', v_request_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_request_reschedule(TEXT, UUID, DATE, TIME, TEXT) TO service_role;

-- ============================================
-- RPC: patient_get_sale
-- Devuelve detalle completo de un recibo (sale + items + payment si existe).
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_get_sale(
  p_token TEXT,
  p_sale_id UUID
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

  -- Verifica ownership
  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND patient_id = v_session.patient_id
  ) THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  SELECT json_build_object(
    'sale', (
      SELECT json_build_object(
        'id', s.id, 'date', s.date, 'total', s.total,
        'payment_method', s.payment_method, 'status', s.status,
        'notes', s.notes, 'created_at', s.created_at,
        'appointment_id', s.appointment_id, 'jornada_id', s.jornada_id
      )
      FROM sales s WHERE s.id = p_sale_id
    ),
    'items', (
      SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.created_at), '[]'::json)
      FROM (
        SELECT id, item_type, item_name, quantity, unit_price, subtotal, created_at
        FROM sale_items WHERE sale_id = p_sale_id
      ) i
    ),
    'payment', (
      SELECT row_to_json(p)
      FROM (
        SELECT id, reference, amount, status, payment_method,
               paid_at, payment_url, provider_transaction_id
        FROM payments
        WHERE sale_id = p_sale_id OR id::TEXT = (
          SELECT s.notes FROM sales s WHERE s.id = p_sale_id LIMIT 1
        )
        ORDER BY created_at DESC LIMIT 1
      ) p
    ),
    'clinic', (
      SELECT json_build_object(
        'name', t.name, 'phone', t.phone, 'address', t.address, 'city', t.city
      )
      FROM tenants t WHERE t.id = v_session.tenant_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_get_sale(TEXT, UUID) TO service_role;
