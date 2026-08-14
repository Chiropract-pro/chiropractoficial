-- ============================================
-- 056_informe_reactivacion_tipo.sql
--
-- `reactivation_report` fallaba SIEMPRE con 42804 («structure of query does not
-- match function result type»): la pantalla «Lo que hizo el bot» mostraba cero
-- en todo y dejaba un error en la consola.
--
-- La causa: `reactivation_touches.estimated_value` es BIGINT en la tabla, pero
-- la función lo declaraba NUMERIC en su tipo de retorno. Postgres no convierte
-- solo en un RETURNS TABLE — exige que el tipo coincida exactamente.
--
-- Se deja NUMERIC en la firma (es lo que espera la interfaz para sumar) y se
-- convierte de forma explícita en la consulta.
--
-- Por qué no se detectó antes: la pantalla se probó en modo demostración, que
-- sirve datos fijos sin llamar a la función. Solo apareció con sesión real.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/056_informe_reactivacion_tipo.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.reactivation_report(
  p_tenant_id uuid,
  p_days      int DEFAULT 90
)
RETURNS TABLE (
  touch_id        uuid,
  patient_id      uuid,
  full_name       text,
  phone           text,
  segment         text,
  estimated_value numeric,
  sent_at         timestamptz,
  replied_at      timestamptz,
  booked_at       timestamptz,
  appointment_date date,
  outcome         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT is_tenant_member(p_tenant_id) THEN
    RAISE EXCEPTION 'Sin acceso al consultorio';
  END IF;

  RETURN QUERY
  WITH toques AS (
    SELECT r.id, r.patient_id, r.segment,
           -- La columna es BIGINT; la firma expone NUMERIC. Sin esta conversión
           -- explícita, Postgres rechaza la consulta entera con 42804.
           r.estimated_value::numeric AS valor,
           r.created_at,
           p.full_name::text AS nombre,
           p.phone::text     AS tel,
           RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) AS cola
    FROM reactivation_touches r
    JOIN patients p ON p.id = r.patient_id
    WHERE r.tenant_id = p_tenant_id
      AND r.created_at > now() - (p_days || ' days')::interval
  )
  SELECT
    t.id,
    t.patient_id,
    t.nombre,
    t.tel,
    t.segment,
    t.valor,
    t.created_at,
    resp.cuando,
    cita.creada,
    cita.fecha,
    (CASE
      WHEN cita.creada IS NOT NULL THEN 'volvio'
      WHEN resp.cuando IS NOT NULL THEN 'respondio'
      ELSE                              'sin_respuesta'
    END)::text
  FROM toques t
  LEFT JOIN LATERAL (
    SELECT min(m.created_at) AS cuando
    FROM whatsapp_messages m
    JOIN whatsapp_conversations c ON c.id = m.conversation_id
    WHERE c.tenant_id = p_tenant_id
      AND m.direction = 'inbound'
      AND m.created_at > t.created_at
      AND RIGHT(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 10) = t.cola
  ) resp ON TRUE
  LEFT JOIN LATERAL (
    SELECT min(a.created_at) AS creada, min(a.date) AS fecha
    FROM appointments a
    WHERE a.patient_id = t.patient_id
      AND a.created_at > t.created_at
      AND a.status <> 'cancelada'
  ) cita ON TRUE
  ORDER BY t.created_at DESC;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reactivation_report(uuid, int) TO authenticated;

-- ── Comprobación: se ejecuta como el dueño, igual que lo hará la pantalla ───
DO $$
DECLARE v_u uuid; v_t uuid; v_n int;
BEGIN
  SELECT id INTO v_u FROM auth.users WHERE email = 'quiropraxiajuly2023@gmail.com';
  SELECT id INTO v_t FROM public.tenants WHERE slug = 'dr-miguel-angel-diaz';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_u::text, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';

  SELECT count(*) INTO v_n FROM public.reactivation_report(v_t, 90);
  RAISE NOTICE 'reactivation_report corre sin error: % filas', v_n;
END $$;
