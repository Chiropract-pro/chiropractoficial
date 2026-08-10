-- ============================================
-- 048_wa_acuses_entrega.sql
-- Los acuses de Meta llegaban al webhook y se tiraban a la basura
--
-- QUÉ PASABA
-- Meta manda un webhook por cada cambio de estado de un mensaje enviado:
-- `sent`, `delivered`, `read` o `failed`. El bot los recibía, el primer filtro
-- los descartaba por no traer texto, y ahí morían.
--
-- Consecuencia: en el CRM un mensaje que Meta RECHAZÓ figura como «enviado»
-- para siempre. Se descubrió en carne propia — el mensaje de prueba a
-- Sebastián nunca llegó (error 131047, fuera de la ventana de 24 h) y hubo que
-- ir a buscar el motivo a mano en las ejecuciones de n8n, porque el sistema no
-- se había enterado.
--
-- Para un canal por el que se persiguen citas, la diferencia entre «enviados»
-- y «entregados» es la única que importa.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/048_wa_acuses_entrega.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.wa_update_status(
  p_wa_message_id TEXT,
  p_status        TEXT,
  p_error_code    TEXT DEFAULT NULL,
  p_error_title   TEXT DEFAULT NULL
)
RETURNS TABLE (actualizado BOOLEAN, conversation_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_conv UUID;
  v_estado TEXT;
BEGIN
  IF COALESCE(p_wa_message_id, '') = '' THEN
    RETURN QUERY SELECT FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- El CHECK heredado solo admite queued/sent/delivered/read/failed; cualquier
  -- estado nuevo de Meta se archiva como 'sent' antes que reventar la fila.
  v_estado := CASE lower(COALESCE(p_status, ''))
    WHEN 'sent'      THEN 'sent'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'read'      THEN 'read'
    WHEN 'failed'    THEN 'failed'
    ELSE 'sent'
  END;

  UPDATE whatsapp_messages m
     SET status       = v_estado,
         delivered_at = CASE WHEN v_estado IN ('delivered', 'read')
                             THEN COALESCE(m.delivered_at, NOW()) ELSE m.delivered_at END,
         read_at      = CASE WHEN v_estado = 'read'
                             THEN COALESCE(m.read_at, NOW()) ELSE m.read_at END,
         error        = CASE WHEN v_estado = 'failed'
                             THEN NULLIF(TRIM(COALESCE(p_error_code, '') || ' ' ||
                                              COALESCE(p_error_title, '')), '')
                             ELSE m.error END
   WHERE m.wa_message_id = p_wa_message_id
  RETURNING m.conversation_id INTO v_conv;

  -- Un mensaje fallido deja la conversación marcada para que alguien la mire:
  -- si Meta lo rechazó, el paciente no se enteró de nada.
  IF v_estado = 'failed' AND v_conv IS NOT NULL THEN
    UPDATE whatsapp_conversations SET needs_human = TRUE, updated_at = NOW()
     WHERE id = v_conv;
  END IF;

  RETURN QUERY SELECT (v_conv IS NOT NULL), v_conv;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.wa_update_status(TEXT,TEXT,TEXT,TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.wa_update_status(TEXT,TEXT,TEXT,TEXT) TO service_role;

-- El informe diario pasa a contar ENTREGADOS, no solo enviados.
-- `CREATE OR REPLACE VIEW` no admite insertar columnas en medio (renombraría
-- las siguientes), así que se recrea.
DROP VIEW IF EXISTS public.wa_daily_report;
CREATE VIEW public.wa_daily_report
WITH (security_invoker = true) AS
SELECT
  m.tenant_id,
  (m.created_at AT TIME ZONE 'America/Bogota')::DATE          AS dia,
  count(*) FILTER (WHERE m.direction = 'outbound')             AS enviados,
  count(*) FILTER (WHERE m.direction = 'outbound'
                     AND m.status IN ('delivered', 'read'))    AS entregados,
  count(*) FILTER (WHERE m.direction = 'outbound'
                     AND m.status = 'failed')                  AS fallidos,
  count(*) FILTER (WHERE m.direction = 'outbound'
                     AND m.status = 'read')                    AS leidos,
  count(*) FILTER (WHERE m.direction = 'inbound')              AS recibidos,
  count(*) FILTER (WHERE m.sent_by = 'campana')                AS de_campana,
  count(*) FILTER (WHERE m.sent_by = 'bot')                    AS del_bot,
  count(*) FILTER (WHERE m.sent_by = 'humano')                 AS de_humano,
  count(DISTINCT m.conversation_id)                            AS conversaciones,
  count(DISTINCT m.conversation_id)
    FILTER (WHERE m.direction = 'inbound')                     AS conversaciones_con_respuesta
FROM whatsapp_messages m
GROUP BY m.tenant_id, 2;

DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'wa_update_status';
  IF v_n <> 1 THEN RAISE EXCEPTION 'Se esperaba 1 wa_update_status, hay %', v_n; END IF;
END $$;
