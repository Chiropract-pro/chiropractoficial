-- ============================================
-- 047_bot_doctor_invalido.sql
-- Un id de doctor caduco tumbaba el agendamiento con un 409 opaco
--
-- SÍNTOMA
-- Con la firma ya corregida (044) y la identidad ya resuelta (045), el bot
-- seguía contestando «hubo un inconveniente al registrar su cita». PostgREST
-- devolvía **409** — y la herramienta de n8n descarta el cuerpo del error, así
-- que el motivo real nunca llegaba a los registros.
--
-- CAUSA
-- La herramienta `agendar_cita_pendiente` no usa el doctor que le pasa el
-- agente: trae los ids **quemados en su propio código**.
--
--   const DOCTOR_MIGUEL = '7f4d2f3c-7ac4-4ca6-9483-889b60ca934b';
--
-- Ese usuario NO existe. `appointments.assigned_doctor_id` referencia
-- `auth.users`, así que la inserción violaba la clave foránea y PostgREST
-- traducía el 23503 a un 409 sin explicación. El id real del Dr. Miguel Ángel
-- Díaz es `6bed8f3d-e496-4217-b05c-d22888ee8168`.
--
-- SOLUCIÓN
-- La función deja de confiar en el id que le manden. Si el doctor recibido no
-- existe, se asigna al dueño del consultorio y la cita se crea igual. Un dato
-- desactualizado en un integrador no puede costarle una cita al consultorio;
-- perder al paciente es mucho peor que asignarle el doctor por defecto.
--
-- Se corrige en la base a propósito, y no solo en el código de n8n: así queda
-- protegido cualquier otro integrador que llame con un id viejo.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/047_bot_doctor_invalido.sql
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
  v_doctor UUID := p_doctor_id;
BEGIN
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede agendar en fechas pasadas';
  END IF;

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

  IF v_patient IS NULL THEN
    INSERT INTO patients (tenant_id, full_name, phone, status, needs_review)
    VALUES (
      p_tenant_id,
      NULLIF(TRIM(COALESCE(p_patient_name, '')), ''),
      v_phone, 'activo', TRUE
    )
    RETURNING id INTO v_patient;
  END IF;

  -- ── Qué doctor ───────────────────────────────────────────────────────────
  -- Un id que no existe reventaría contra auth.users y devolvería un 409 sin
  -- explicación. Se descarta en silencio y se cae al dueño del consultorio:
  -- vale mil veces más una cita con el doctor por defecto que una cita perdida.
  IF v_doctor IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_doctor) THEN
    v_doctor := NULL;
  END IF;

  IF v_doctor IS NULL THEN
    SELECT m.user_id INTO v_doctor
    FROM tenant_memberships m
    WHERE m.tenant_id = p_tenant_id AND m.role = 'owner'
    LIMIT 1;
  END IF;

  -- ── Tarifa del consultorio ───────────────────────────────────────────────
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

  SELECT p.phone, p.full_name INTO v_doctor_phone, v_doctor_name
  FROM profiles p WHERE p.id = v_doctor;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, patient_phone, assigned_doctor_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    p_tenant_id, v_patient, p_patient_name, v_phone, v_doctor,
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
      v_doctor,
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
