-- ============================================
-- 046_bot_crea_paciente.sql
-- El bot no podía agendar a quien todavía no era paciente
--
-- SÍNTOMA
--   null value in column "patient_id" of relation "appointments"
--   violates not-null constraint
--
-- POR QUÉ IMPORTA
-- `appointments.patient_id` es obligatorio. Mientras el bot solo respondía a
-- pacientes ya registrados eso no molestaba, pero el objetivo del canal es
-- **conseguir citas nuevas**: alguien que ve el perfil público, escribe al
-- WhatsApp y quiere venir. Esa persona no tiene ficha todavía, así que la cita
-- reventaba y el bot contestaba «hubo un inconveniente».
--
-- QUÉ HACE
-- Si no llega `p_patient_id`, la función busca por teléfono y, si no existe,
-- **crea la ficha del paciente** antes de agendar. Queda marcada con
-- `needs_review = TRUE` para que la recepción la complete: el bot solo conoce
-- el nombre de WhatsApp y el número.
--
-- La búsqueda previa usa el mismo criterio que el resto del sistema —
-- coincidencia exacta de los últimos 10 dígitos, y solo si no es ambigua— para
-- no crear fichas duplicadas de alguien que ya existe.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/046_bot_crea_paciente.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.bot_request_appointment(
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
  v_tail TEXT;
  v_matches INT;
  v_patient UUID := p_patient_id;
BEGIN
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede agendar en fechas pasadas';
  END IF;

  -- Teléfono normalizado, mismo criterio que el resto del sistema.
  v_phone := regexp_replace(COALESCE(p_patient_phone, ''), '\D', '', 'g');
  IF length(v_phone) = 10 THEN v_phone := '57' || v_phone; END IF;
  IF v_phone = '' THEN v_phone := NULL; END IF;
  v_tail := RIGHT(COALESCE(v_phone, ''), 10);

  -- ── Quién es el paciente ──────────────────────────────────────────────────
  IF v_patient IS NULL AND length(COALESCE(v_phone, '')) >= 10 THEN
    SELECT count(*) INTO v_matches
    FROM patients p
    WHERE p.tenant_id = p_tenant_id
      AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
      AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail;

    IF v_matches = 1 THEN
      SELECT p.id INTO v_patient
      FROM patients p
      WHERE p.tenant_id = p_tenant_id
        AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
        AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail
      LIMIT 1;
    END IF;
  END IF;

  -- Sigue sin ficha: se crea. Es un paciente nuevo llegando por WhatsApp, que
  -- es justo lo que el canal existe para conseguir.
  IF v_patient IS NULL THEN
    INSERT INTO patients (tenant_id, full_name, phone, status, needs_review)
    VALUES (
      p_tenant_id,
      NULLIF(TRIM(COALESCE(p_patient_name, '')), ''),
      v_phone,
      'activo',
      TRUE          -- la recepción debe completar y verificar estos datos
    )
    RETURNING id INTO v_patient;
  END IF;

  -- ── Tarifa del consultorio (Ajustes → Tarifas), con valores de fábrica ────
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

  IF p_doctor_id IS NULL THEN
    SELECT user_id INTO p_doctor_id
    FROM tenant_memberships
    WHERE tenant_id = p_tenant_id AND role = 'owner'
    LIMIT 1;
  END IF;

  SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
  FROM profiles p WHERE p.id = p_doctor_id;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, patient_phone, assigned_doctor_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    p_tenant_id, v_patient, p_patient_name, v_phone, p_doctor_id,
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
      p_tenant_id, v_patient, v_appt.id, 'whatsapp', 'doctor_new_appointment',
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
