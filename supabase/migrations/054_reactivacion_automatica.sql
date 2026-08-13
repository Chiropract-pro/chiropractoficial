-- ============================================
-- 054_reactivacion_automatica.sql
--
-- QUÉ RESUELVE
--   El Radar de Reactivación proponía a quién llamar, pero llamaba una persona.
--   Con 1.229 pacientes con celular y 1.421 sin venir hace más de dos meses,
--   eso no se hace a mano: se hace o no se hace.
--
--   Aquí queda la parte de base de datos para que el bot de n8n lo haga solo:
--     · a quién le toca hoy            → bot_reactivation_queue
--     · dejar constancia de que se le escribió → bot_reactivation_record
--     · qué pasó después                → reactivation_report
--
-- LA REGLA QUE GOBIERNA TODO: NO MOLESTAR
--   Un consultorio que escribe dos veces al mismo paciente pierde más de lo que
--   gana. La cola excluye, sin excepción:
--     · a quien ya tiene cita futura agendada;
--     · a quien se contactó en los últimos 21 días;
--     · a quien está conversando con el bot ahora mismo (últimos 3 días);
--     · a quien no tiene celular colombiano válido.
--   Y hay un tope diario por consultorio: aunque alguien llame la función diez
--   veces, no salen más de `p_daily_cap` pacientes en el día. Un bot con un
--   error de bucle no puede convertirse en 1.229 mensajes.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/054_reactivacion_automatica.sql
-- ============================================

-- ── 1. A quién le toca hoy ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bot_reactivation_queue(
  p_tenant_id uuid,
  p_limit     int DEFAULT 25,
  p_daily_cap int DEFAULT 40
)
RETURNS TABLE (
  patient_id         uuid,
  full_name          text,
  first_name         text,
  phone              text,
  segment            text,
  days_since_visit   int,
  balance_due        numeric,
  appointments_count int,
  estimated_value    numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_hoy      int;
  v_restante int;
  v_ticket   numeric;
BEGIN
  -- Tope diario: lo ya enviado hoy descuenta del cupo.
  SELECT count(*) INTO v_hoy
  FROM reactivation_touches r
  WHERE r.tenant_id = p_tenant_id
    AND r.channel = 'whatsapp'
    AND r.created_at >= date_trunc('day', now() AT TIME ZONE 'America/Bogota');

  v_restante := LEAST(GREATEST(p_daily_cap - v_hoy, 0), GREATEST(p_limit, 0));
  IF v_restante = 0 THEN RETURN; END IF;

  -- Tarifa del consultorio para estimar lo recuperable.
  SELECT COALESCE(NULLIF(t.appointment_prices ->> 'primera_consulta', '')::numeric, 165000)
    INTO v_ticket
  FROM tenants t WHERE t.id = p_tenant_id;

  RETURN QUERY
  WITH candidatos AS (
    SELECT
      p.id,
      p.full_name,
      p.phone,
      COALESCE(p.balance_due, 0)::numeric AS saldo,
      COALESCE(p.appointments_count, 0)   AS visitas,
      CASE WHEN p.last_visit IS NULL THEN 9999
           ELSE (CURRENT_DATE - p.last_visit)::int END AS dias,
      p.status
    FROM patients p
    WHERE p.tenant_id = p_tenant_id
      -- Celular colombiano de verdad: la plantilla sale por WhatsApp.
      AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') ~ '^(57)?3\d{9}$'
      -- Lleva dos meses sin venir (o nunca registró visita pero ya tuvo citas).
      AND (p.last_visit IS NULL OR p.last_visit < CURRENT_DATE - 60)
      AND COALESCE(p.appointments_count, 0) >= 1
      -- Nada de citas futuras: ya volvió, no hay que reactivarlo.
      AND NOT EXISTS (
        SELECT 1 FROM appointments a
        WHERE a.patient_id = p.id
          AND a.date >= CURRENT_DATE
          AND a.status <> 'cancelada'
      )
      -- Ni contactado hace poco.
      AND NOT EXISTS (
        SELECT 1 FROM reactivation_touches r
        WHERE r.patient_id = p.id
          AND r.created_at > now() - INTERVAL '21 days'
      )
      -- Ni en medio de una conversación viva con el bot.
      AND NOT EXISTS (
        SELECT 1 FROM whatsapp_conversations c
        WHERE c.tenant_id = p_tenant_id
          AND RIGHT(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 10)
            = RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10)
          AND c.last_message_at > now() - INTERVAL '3 days'
      )
  )
  SELECT
    c.id,
    c.full_name,
    -- Solo el primer nombre: «Hola María Fernanda Ríos Gómez» no lo escribe
    -- ningún humano.
    NULLIF(split_part(TRIM(c.full_name), ' ', 1), ''),
    -- Normalizado a E.164 sin el «+», que es como lo quiere Meta.
    CASE WHEN length(regexp_replace(c.phone, '\D', '', 'g')) = 10
         THEN '57' || regexp_replace(c.phone, '\D', '', 'g')
         ELSE regexp_replace(c.phone, '\D', '', 'g') END,
    CASE
      WHEN c.saldo > 0                          THEN 'saldo'
      WHEN c.status = 'en_tratamiento'          THEN 'abandono'
      WHEN c.visitas >= 2                       THEN 'dormido'
      ELSE                                           'primera'
    END,
    c.dias,
    c.saldo,
    c.visitas,
    CASE WHEN c.saldo > 0 THEN c.saldo ELSE v_ticket END
  FROM candidatos c
  ORDER BY
    c.saldo DESC,          -- primero lo ya facturado que nunca entró
    c.dias ASC,            -- y de ahí, quien se fue hace menos: todavía se acuerda
    c.visitas DESC
  LIMIT v_restante;
END;
$function$;

-- ── 2. Dejar constancia ─────────────────────────────────────────────────────
-- Se escribe SIEMPRE que se manda un mensaje, con éxito o sin él. Si solo se
-- anotaran los envíos exitosos, un fallo de Meta haría que el mismo paciente
-- volviera a la cola cada hora.
--
-- `outcome` en NULL significa «mandado, todavía sin respuesta»: la tabla ya
-- tiene una restricción con los desenlaces reales (agendo, pago, rechazo,
-- numero_malo, sin_respuesta) y no hacía falta inventarle un estado nuevo.
-- Cuando Meta rechaza el número, el bot pasa 'numero_malo' y ese paciente
-- queda marcado sin volver a intentarlo.
CREATE OR REPLACE FUNCTION public.bot_reactivation_record(
  p_tenant_id       uuid,
  p_patient_id      uuid,
  p_segment         text DEFAULT NULL,
  p_estimated_value numeric DEFAULT NULL,
  p_outcome         text DEFAULT NULL,
  p_notes           text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE v_id uuid;
BEGIN
  INSERT INTO reactivation_touches
    (tenant_id, patient_id, user_id, channel, segment, estimated_value, outcome, notes)
  VALUES
    (p_tenant_id, p_patient_id, NULL, 'whatsapp', p_segment, p_estimated_value,
     p_outcome, p_notes)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

-- ── 3. Qué pasó después ─────────────────────────────────────────────────────
-- El resultado no se guarda: se calcula. Guardarlo obligaría a un proceso que
-- lo mantenga al día, y ese proceso se cae. Aquí «respondió» y «volvió» se
-- deducen de los mensajes y las citas posteriores al contacto, así que la
-- pantalla nunca puede quedar desfasada de la realidad.
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
    SELECT r.id, r.patient_id, r.segment, r.estimated_value, r.created_at,
           p.full_name, p.phone,
           RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) AS cola
    FROM reactivation_touches r
    JOIN patients p ON p.id = r.patient_id
    WHERE r.tenant_id = p_tenant_id
      AND r.created_at > now() - (p_days || ' days')::interval
  )
  SELECT
    t.id,
    t.patient_id,
    t.full_name,
    t.phone,
    t.segment,
    t.estimated_value,
    t.created_at,
    resp.cuando,
    cita.creada,
    cita.fecha,
    CASE
      WHEN cita.creada IS NOT NULL THEN 'volvio'
      WHEN resp.cuando IS NOT NULL THEN 'respondio'
      ELSE                              'sin_respuesta'
    END
  FROM toques t
  -- ¿Contestó? Cualquier mensaje entrante de ese número después del contacto.
  LEFT JOIN LATERAL (
    SELECT min(m.created_at) AS cuando
    FROM whatsapp_messages m
    JOIN whatsapp_conversations c ON c.id = m.conversation_id
    WHERE c.tenant_id = p_tenant_id
      AND m.direction = 'inbound'
      AND m.created_at > t.created_at
      AND RIGHT(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 10) = t.cola
  ) resp ON TRUE
  -- ¿Volvió? Cita agendada después del contacto y no cancelada.
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

-- ── Permisos ────────────────────────────────────────────────────────────────
-- Las dos primeras las llama el bot con la llave de servicio: nadie más.
REVOKE ALL ON FUNCTION public.bot_reactivation_queue(uuid, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bot_reactivation_record(uuid, uuid, text, numeric, text, text) FROM PUBLIC, anon, authenticated;
-- El informe lo lee el consultorio desde el CRM, y valida membresía por dentro.
GRANT EXECUTE ON FUNCTION public.reactivation_report(uuid, int) TO authenticated;

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tenant uuid;
  v_n      int;
  v_futuras int;
BEGIN
  SELECT id INTO v_tenant FROM tenants WHERE slug = 'dr-miguel-angel-diaz';

  SELECT count(*) INTO v_n FROM bot_reactivation_queue(v_tenant, 25);
  IF v_n = 0 THEN
    RAISE EXCEPTION 'La cola salió vacía y debía traer candidatos';
  END IF;

  -- Nadie de la cola puede tener cita futura: es la regla que más duele romper.
  SELECT count(*) INTO v_futuras
  FROM bot_reactivation_queue(v_tenant, 40) q
  WHERE EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.patient_id = q.patient_id AND a.date >= CURRENT_DATE AND a.status <> 'cancelada'
  );
  IF v_futuras > 0 THEN
    RAISE EXCEPTION '% candidatos ya tenían cita futura', v_futuras;
  END IF;

  RAISE NOTICE 'Cola de reactivación: % candidatos, ninguno con cita futura', v_n;
END $$;
