-- ============================================
-- 052_cita_publica_desde_la_web.sql
--
-- QUÉ FALTABA
--   El perfil público del médico tenía un botón «Agendar cita» que abría
--   WhatsApp. Servir, sirve — el bot agenda —, pero obliga al paciente a
--   escribir por chat y a esperar. Quien entra a las once de la noche a la
--   página del doctor quiere dejar su solicitud y acostarse.
--
--   Esta función deja que el sitio público cree una SOLICITUD de cita. No es
--   una cita confirmada: entra como 'pendiente' y el consultorio la aprueba,
--   igual que las que llegan por el bot.
--
-- POR QUÉ NO SE ABRE `appointments` A `anon` DIRECTAMENTE
--   Sería dejar la agenda a merced de cualquiera con la clave pública. Aquí el
--   único camino es esta función, que valida y limita:
--     · el consultorio se resuelve por el slug del perfil, y solo si es público
--       y está aceptando pacientes;
--     · el nombre y el celular tienen que ser plausibles (celular colombiano);
--     · nada de fechas pasadas ni a más de 90 días;
--     · tope de 3 solicitudes por celular al día y 20 por consultorio por hora,
--       para que un robot no llene la agenda de basura.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/052_cita_publica_desde_la_web.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.public_request_appointment(
  p_slug  text,
  p_name  text,
  p_phone text,
  p_date  date,
  p_time  time without time zone,
  p_type  text DEFAULT 'primera_consulta',
  p_notes text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_tenant   uuid;
  v_doctor   uuid;
  v_nombre   text := TRIM(COALESCE(p_name, ''));
  v_phone    text;
  v_tail     text;
  v_patient  uuid;
  v_price    bigint;
  v_appt     appointments%ROWTYPE;
  v_del_dia  int;
  v_de_hora  int;
BEGIN
  -- ── El consultorio, por el perfil público ────────────────────────────────
  SELECT pp.tenant_id, pp.user_id
    INTO v_tenant, v_doctor
  FROM practitioner_profiles pp
  WHERE pp.slug = p_slug
    AND pp.is_public IS TRUE
    AND pp.accepting_patients IS TRUE;

  IF v_tenant IS NULL THEN
    RETURN json_build_object('ok', false, 'error',
      'Este consultorio no está recibiendo solicitudes por la página.');
  END IF;

  -- ── Datos plausibles ─────────────────────────────────────────────────────
  IF length(v_nombre) < 3 THEN
    RETURN json_build_object('ok', false, 'error', 'Escriba su nombre completo.');
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_phone) = 10 THEN v_phone := '57' || v_phone; END IF;
  -- Celular colombiano: 57 + 3xxxxxxxxx. Un fijo no sirve, porque la
  -- confirmación y el recordatorio salen por WhatsApp.
  IF v_phone !~ '^573\d{9}$' THEN
    RETURN json_build_object('ok', false, 'error',
      'Escriba un celular colombiano de 10 dígitos, empezando por 3.');
  END IF;
  v_tail := RIGHT(v_phone, 10);

  IF p_date < CURRENT_DATE THEN
    RETURN json_build_object('ok', false, 'error', 'Esa fecha ya pasó.');
  END IF;
  IF p_date > CURRENT_DATE + 90 THEN
    RETURN json_build_object('ok', false, 'error',
      'Por ahora solo se agenda con hasta 90 días de anticipación.');
  END IF;

  IF p_type NOT IN ('primera_consulta', 'seguimiento', 'jornada', 'emergencia') THEN
    RETURN json_build_object('ok', false, 'error', 'Tipo de cita no válido.');
  END IF;

  -- ── Frenos contra el abuso ───────────────────────────────────────────────
  SELECT count(*) INTO v_del_dia
  FROM appointments a
  WHERE a.tenant_id = v_tenant
    AND RIGHT(regexp_replace(COALESCE(a.patient_phone, ''), '\D', '', 'g'), 10) = v_tail
    AND a.created_at > NOW() - INTERVAL '24 hours';

  IF v_del_dia >= 3 THEN
    RETURN json_build_object('ok', false, 'error',
      'Ya hay varias solicitudes con este número hoy. El consultorio se comunicará con usted.');
  END IF;

  SELECT count(*) INTO v_de_hora
  FROM appointments a
  WHERE a.tenant_id = v_tenant
    AND a.notes LIKE '%[Solicitada desde la web]%'
    AND a.created_at > NOW() - INTERVAL '1 hour';

  IF v_de_hora >= 20 THEN
    RETURN json_build_object('ok', false, 'error',
      'Estamos recibiendo muchas solicitudes. Intente de nuevo en un rato.');
  END IF;

  -- ── El paciente: se reusa si el celular ya está, si no se crea ───────────
  SELECT p.id INTO v_patient
  FROM patients p
  WHERE p.tenant_id = v_tenant
    AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
    AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail
  LIMIT 1;

  IF v_patient IS NULL THEN
    INSERT INTO patients (tenant_id, full_name, phone, status, needs_review)
    VALUES (v_tenant, v_nombre, v_phone, 'activo', TRUE)
    RETURNING id INTO v_patient;
  END IF;

  -- ── Tarifa del consultorio ───────────────────────────────────────────────
  SELECT NULLIF(t.appointment_prices ->> p_type, '')::bigint
    INTO v_price
  FROM tenants t WHERE t.id = v_tenant;

  IF v_price IS NULL OR v_price < 0 THEN
    v_price := CASE p_type WHEN 'emergencia' THEN 200000 ELSE 165000 END;
  END IF;

  IF v_doctor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_doctor) THEN
    v_doctor := NULL;
  END IF;
  IF v_doctor IS NULL THEN
    SELECT m.user_id INTO v_doctor
    FROM tenant_memberships m
    WHERE m.tenant_id = v_tenant AND m.role = 'owner' LIMIT 1;
  END IF;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name, patient_phone, assigned_doctor_id,
    date, time, type, location, status, price, notes
  )
  VALUES (
    v_tenant, v_patient, v_nombre, v_phone, v_doctor,
    p_date, p_time, p_type, 'Consultorio', 'pendiente', v_price,
    TRIM(COALESCE(p_notes, '')) || ' [Solicitada desde la web]'
  )
  RETURNING * INTO v_appt;

  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    v_tenant, 'info',
    'Solicitud de cita desde la página: ' || v_nombre || ' para ' || p_date || ' a las ' || p_time,
    'review_appointment', v_appt.id
  );

  RETURN json_build_object(
    'ok', true,
    'fecha', p_date,
    'hora', to_char(p_time, 'HH12:MI AM'),
    'mensaje', 'Su solicitud quedó registrada. El consultorio la confirma por WhatsApp.'
  );
END;
$function$;

-- El visitante de la página no tiene sesión: entra como `anon`.
REVOKE ALL ON FUNCTION public.public_request_appointment(text, text, text, date, time, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_request_appointment(text, text, text, date, time, text, text) TO anon, authenticated;

-- ── De paso: el respaldo de tarifa del bot seguía en 175.000 ───────────────
-- Solo se usa cuando el consultorio no tiene tarifas propias, pero era el
-- precio viejo, el que el Dr. Miguel corrigió dos veces en la entrega.
CREATE OR REPLACE FUNCTION public.bot_request_appointment(
  p_tenant_id uuid, p_patient_id uuid, p_patient_name text, p_date date,
  p_time time without time zone, p_type text, p_location text DEFAULT 'consultorio',
  p_notes text DEFAULT NULL, p_doctor_id uuid DEFAULT NULL, p_patient_phone text DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
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
    VALUES (p_tenant_id, NULLIF(TRIM(COALESCE(p_patient_name, '')), ''), v_phone, 'activo', TRUE)
    RETURNING id INTO v_patient;
  END IF;

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

  SELECT NULLIF(t.appointment_prices ->> p_type, '')::BIGINT
    INTO v_price
  FROM tenants t WHERE t.id = p_tenant_id;

  IF v_price IS NULL OR v_price < 0 THEN
    v_price := CASE p_type WHEN 'emergencia' THEN 200000 ELSE 165000 END;
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
$function$;

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'public_request_appointment';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'public_request_appointment quedó % veces (debe ser 1)', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'bot_request_appointment';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'bot_request_appointment quedó % veces (debe ser 1) — un duplicado rompe PostgREST', v_n;
  END IF;
END $$;
