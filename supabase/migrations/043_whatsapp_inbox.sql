-- ============================================
-- 043_whatsapp_inbox.sql
-- La bandeja de conversaciones: de Evolution a Meta Cloud API
--
-- DE DÓNDE VENIMOS
-- `whatsapp_conversations` y `whatsapp_messages` existen desde el principio
-- pero están VACÍAS (0 filas) y modeladas para Evolution API — el camino no
-- oficial que ya se jubiló. Sus columnas hablan de `evolution_instance_id` y
-- `evolution_message_id`.
--
-- Hoy el bot corre sobre **Meta Cloud API** (n8n «WABA Cloud API bot v5»,
-- phone_number_id 1102408332962483) y NO persiste nada: su memoria vive en la
-- tabla de chat de n8n. Es decir, el consultorio no puede ver ni una sola
-- conversación desde el CRM, ni medir si el bot está sirviendo de algo.
--
-- QUÉ HACE ESTA MIGRACIÓN
--   1. Añade las columnas de Meta (wamid, phone_number_id, quién envió).
--   2. Añade lo que la bandeja necesita: no leídos, nombre del contacto y la
--      ventana de 24 h.
--   3. Índices para las consultas de la bandeja.
--   4. `wa_log_message`: registrar un mensaje sin condiciones de carrera.
--   5. `wa_mark_read`, y la vista del informe diario.
--   6. Realtime, para que la bandeja se actualice sola.
--
-- LA VENTANA DE 24 HORAS (regla de Meta, no del código)
-- Fuera de las 24 h siguientes al último mensaje del paciente, Meta PROHÍBE
-- enviar texto libre: solo plantillas aprobadas. Por eso `window_expires_at`
-- vive en la fila y la mantiene el servidor, no el cliente: la interfaz tiene
-- que saber, sin margen de error, si puede escribir libremente o no.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/043_whatsapp_inbox.sql
-- ============================================

-- ── 1. Conversaciones ───────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT,
  ADD COLUMN IF NOT EXISTS contact_name       TEXT,
  ADD COLUMN IF NOT EXISTS unread_count       INT     NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_message_text  TEXT,
  ADD COLUMN IF NOT EXISTS last_direction     TEXT,
  ADD COLUMN IF NOT EXISTS last_campaign      TEXT,
  ADD COLUMN IF NOT EXISTS needs_human        BOOLEAN NOT NULL DEFAULT FALSE;

-- La ventana se deriva del último mensaje entrante. No puede ser columna
-- generada: `timestamptz + interval` no es inmutable para Postgres. La
-- mantiene `wa_log_message`, que es el único camino por el que entra un
-- mensaje, así que no puede quedar desincronizada.
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS window_expires_at TIMESTAMPTZ;

-- Una conversación por teléfono y consultorio: es lo que hace posible el
-- upsert sin duplicar hilos cuando llegan dos mensajes a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_tenant_phone
  ON public.whatsapp_conversations (tenant_id, phone);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_bandeja
  ON public.whatsapp_conversations (tenant_id, last_message_at DESC);

-- ── 2. Mensajes ─────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS wa_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_by       TEXT,   -- 'bot' | 'humano' | 'campana' | 'paciente'
  ADD COLUMN IF NOT EXISTS template_name TEXT,
  ADD COLUMN IF NOT EXISTS campaign      TEXT,
  ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS read_at       TIMESTAMPTZ;

-- El wamid de Meta es único; sirve de llave de idempotencia para que un
-- reintento del webhook no duplique el mensaje.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wamid
  ON public.whatsapp_messages (wa_message_id) WHERE wa_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_hilo
  ON public.whatsapp_messages (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS whatsapp_messages_informe
  ON public.whatsapp_messages (tenant_id, created_at DESC);

-- ── 3. Registrar un mensaje ─────────────────────────────────────────────────
-- La llama n8n (service_role) tanto para lo que entra como para lo que sale.
-- Hace el upsert de la conversación y la inserción del mensaje en una sola
-- transacción: sin esto, dos mensajes simultáneos del mismo número crean dos
-- hilos y la bandeja se parte en dos.
CREATE OR REPLACE FUNCTION public.wa_log_message(
  p_tenant_id     UUID,
  p_phone         TEXT,
  p_direction     TEXT,                    -- 'inbound' | 'outbound'
  p_content       TEXT,
  p_wa_message_id TEXT    DEFAULT NULL,
  p_sent_by       TEXT    DEFAULT NULL,
  p_message_type  TEXT    DEFAULT 'text',
  p_template_name TEXT    DEFAULT NULL,
  p_campaign      TEXT    DEFAULT NULL,
  p_contact_name  TEXT    DEFAULT NULL,
  p_metadata      JSONB   DEFAULT '{}'::JSONB
)
RETURNS TABLE (conversation_id UUID, message_id UUID, es_nuevo BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone TEXT;
  v_conv  UUID;
  v_msg   UUID;
  v_patient UUID;
  v_inbound BOOLEAN := (p_direction = 'inbound');
  v_nuevo BOOLEAN := FALSE;
BEGIN
  IF p_direction NOT IN ('inbound', 'outbound') THEN
    RAISE EXCEPTION 'direction debe ser inbound u outbound, llegó %', p_direction;
  END IF;

  -- Se guarda normalizado a solo dígitos con indicativo: el mismo criterio que
  -- usa el cliente (utils/phone.js). Si no, «310 200 4000» y «+573102004000»
  -- abrirían dos hilos distintos para la misma persona.
  v_phone := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  IF length(v_phone) = 10 THEN v_phone := '57' || v_phone; END IF;
  IF v_phone = '' THEN RAISE EXCEPTION 'phone vacío'; END IF;

  -- Corte temprano por idempotencia. Meta reintenta los webhooks de rutina, y
  -- si solo se deduplicara el mensaje, el upsert de la conversación de más
  -- abajo ya habría sumado un no-leído y movido `last_message_at` en cada
  -- reintento: los contadores se inflarían solos.
  IF p_wa_message_id IS NOT NULL THEN
    SELECT m.id, m.conversation_id INTO v_msg, v_conv
    FROM whatsapp_messages m
    WHERE m.wa_message_id = p_wa_message_id
    LIMIT 1;
    IF v_conv IS NOT NULL THEN
      RETURN QUERY SELECT v_conv, v_msg, FALSE;
      RETURN;
    END IF;
    v_msg := NULL;
  END IF;

  -- Coincidencia EXACTA por los últimos 10 dígitos, y solo si no es ambigua:
  -- el mismo criterio que el portal del paciente (migración 038). Atar un
  -- chat a la persona equivocada es enseñarle su historia clínica a otro.
  SELECT p.id INTO v_patient
  FROM patients p
  WHERE p.tenant_id = p_tenant_id
    AND RIGHT(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g'), 10) = RIGHT(v_phone, 10)
    AND length(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g')) >= 10
  GROUP BY p.id
  HAVING count(*) = 1
  LIMIT 1;

  IF (SELECT count(*) FROM patients p
      WHERE p.tenant_id = p_tenant_id
        AND RIGHT(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g'), 10) = RIGHT(v_phone, 10)
        AND length(regexp_replace(COALESCE(p.phone,''), '\D', '', 'g')) >= 10) > 1 THEN
    v_patient := NULL;   -- número compartido: no se adivina de quién es
  END IF;

  INSERT INTO whatsapp_conversations AS c (
    tenant_id, phone, patient_id, contact_name, state,
    last_message_at, last_inbound_at, last_outbound_at,
    last_message_text, last_direction, last_campaign, unread_count, window_expires_at
  )
  VALUES (
    p_tenant_id, v_phone, v_patient, p_contact_name, 'active',
    NOW(),
    CASE WHEN v_inbound THEN NOW() END,
    CASE WHEN NOT v_inbound THEN NOW() END,
    left(p_content, 300), p_direction, p_campaign,
    CASE WHEN v_inbound THEN 1 ELSE 0 END,
    CASE WHEN v_inbound THEN NOW() + INTERVAL '24 hours' END
  )
  ON CONFLICT (tenant_id, phone) DO UPDATE SET
    last_message_at  = NOW(),
    last_inbound_at  = CASE WHEN v_inbound THEN NOW() ELSE c.last_inbound_at END,
    last_outbound_at = CASE WHEN NOT v_inbound THEN NOW() ELSE c.last_outbound_at END,
    last_message_text = left(p_content, 300),
    last_direction   = p_direction,
    last_campaign    = COALESCE(p_campaign, c.last_campaign),
    contact_name     = COALESCE(c.contact_name, p_contact_name),
    patient_id       = COALESCE(c.patient_id, v_patient),
    unread_count     = CASE WHEN v_inbound THEN c.unread_count + 1 ELSE c.unread_count END,
    window_expires_at = CASE WHEN v_inbound THEN NOW() + INTERVAL '24 hours' ELSE c.window_expires_at END,
    updated_at       = NOW()
  RETURNING c.id INTO v_conv;

  -- Idempotencia: si Meta reintenta el webhook, el wamid ya está y no se
  -- duplica el mensaje.
  INSERT INTO whatsapp_messages (
    tenant_id, conversation_id, direction, role, content, message_type,
    wa_message_id, sent_by, template_name, campaign, metadata, status
  )
  VALUES (
    p_tenant_id, v_conv, p_direction,
    CASE WHEN v_inbound THEN 'user' ELSE 'assistant' END,
    p_content, COALESCE(p_message_type, 'text'),
    p_wa_message_id,
    COALESCE(p_sent_by, CASE WHEN v_inbound THEN 'paciente' ELSE 'bot' END),
    p_template_name, p_campaign, COALESCE(p_metadata, '{}'::JSONB),
    -- El CHECK heredado solo admite queued/sent/delivered/read/failed: un
    -- mensaje que ya llegó al consultorio es 'delivered'.
    CASE WHEN v_inbound THEN 'delivered' ELSE 'sent' END
  )
  ON CONFLICT (wa_message_id) WHERE wa_message_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_msg;

  v_nuevo := v_msg IS NOT NULL;

  RETURN QUERY SELECT v_conv, v_msg, v_nuevo;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wa_log_message(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.wa_log_message(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,JSONB) TO service_role;

-- ── 4. Marcar leída ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.wa_mark_read(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER          -- respeta RLS: solo miembros del consultorio
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET unread_count = 0, updated_at = NOW()
  WHERE id = p_conversation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.wa_mark_read(UUID) TO authenticated;

-- ── 5. Informe diario ───────────────────────────────────────────────────────
-- security_invoker: cada consultorio ve solo lo suyo, por RLS.
CREATE OR REPLACE VIEW public.wa_daily_report
WITH (security_invoker = true) AS
SELECT
  m.tenant_id,
  (m.created_at AT TIME ZONE 'America/Bogota')::DATE      AS dia,
  count(*) FILTER (WHERE m.direction = 'outbound')         AS enviados,
  count(*) FILTER (WHERE m.direction = 'inbound')          AS recibidos,
  count(*) FILTER (WHERE m.sent_by = 'campana')            AS de_campana,
  count(*) FILTER (WHERE m.sent_by = 'bot')                AS del_bot,
  count(*) FILTER (WHERE m.sent_by = 'humano')             AS de_humano,
  count(DISTINCT m.conversation_id)                        AS conversaciones,
  count(DISTINCT m.conversation_id)
    FILTER (WHERE m.direction = 'inbound')                 AS conversaciones_con_respuesta
FROM whatsapp_messages m
GROUP BY m.tenant_id, 2;

COMMENT ON VIEW public.wa_daily_report IS
  'Actividad de WhatsApp por día y consultorio: enviados, recibidos y de qué origen.';

-- ── 6. Realtime ─────────────────────────────────────────────────────────────
-- Sin esto la bandeja solo se actualizaría al recargar.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE v_faltan TEXT;
BEGIN
  SELECT string_agg(x, ', ') INTO v_faltan FROM (
    SELECT 'whatsapp_conversations.' || c
    FROM unnest(ARRAY['wa_phone_number_id','contact_name','unread_count','window_expires_at']) c
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='whatsapp_conversations' AND column_name=c)
    UNION ALL
    SELECT 'whatsapp_messages.' || c
    FROM unnest(ARRAY['wa_message_id','sent_by','template_name','campaign']) c
    WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema='public' AND table_name='whatsapp_messages' AND column_name=c)
  ) t(x);

  IF v_faltan IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan columnas: %', v_faltan;
  END IF;
END $$;
