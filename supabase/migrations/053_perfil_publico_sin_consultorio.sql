-- ============================================
-- 053_perfil_publico_sin_consultorio.sql
--
-- Al probar la cita pública salió otra cosa: `practitioner_profiles.tenant_id`
-- estaba en NULL para el único perfil publicado. El perfil se ve bien en la
-- página —el nombre, la foto y la biografía viven en la misma fila— pero no
-- estaba amarrado a ningún consultorio, así que nada que dependa de esa
-- relación podía funcionar: ni la cita pública, ni ninguna otra cosa que
-- quiera saber a qué agenda pertenece este médico.
--
-- Se rellena desde la membresía del médico y se le pone una red de seguridad a
-- la función, para que un perfil futuro sin amarrar tampoco rompa el
-- agendamiento.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/053_perfil_publico_sin_consultorio.sql
-- ============================================

-- ── 1. Rellenar lo que falta ────────────────────────────────────────────────
UPDATE public.practitioner_profiles pp
   SET tenant_id = m.tenant_id,
       updated_at = NOW()
  FROM public.tenant_memberships m
 WHERE pp.tenant_id IS NULL
   AND m.user_id = pp.user_id;

-- ── 2. Red de seguridad en la función ──────────────────────────────────────
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
  SELECT pp.tenant_id, pp.user_id
    INTO v_tenant, v_doctor
  FROM practitioner_profiles pp
  WHERE pp.slug = p_slug
    AND pp.is_public IS TRUE
    AND pp.accepting_patients IS TRUE;

  -- Si el perfil no trae consultorio, se deduce de la membresía del médico.
  IF v_tenant IS NULL AND v_doctor IS NOT NULL THEN
    SELECT m.tenant_id INTO v_tenant
    FROM tenant_memberships m WHERE m.user_id = v_doctor LIMIT 1;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN json_build_object('ok', false, 'error',
      'Este consultorio no está recibiendo solicitudes por la página.');
  END IF;

  -- Nombre y apellido: la ficha del paciente con un solo nombre no le sirve a
  -- nadie en el consultorio, y es lo primero que hay que corregir a mano.
  IF length(v_nombre) < 5 OR v_nombre !~ '\S+\s+\S+' THEN
    RETURN json_build_object('ok', false, 'error', 'Escriba su nombre y su apellido.');
  END IF;

  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_phone) = 10 THEN v_phone := '57' || v_phone; END IF;
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

REVOKE ALL ON FUNCTION public.public_request_appointment(text, text, text, date, time, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_request_appointment(text, text, text, date, time, text, text) TO anon, authenticated;

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE v_sin int;
BEGIN
  SELECT count(*) INTO v_sin
  FROM public.practitioner_profiles WHERE is_public IS TRUE AND tenant_id IS NULL;

  IF v_sin > 0 THEN
    RAISE EXCEPTION '% perfiles públicos siguen sin consultorio', v_sin;
  END IF;
END $$;
