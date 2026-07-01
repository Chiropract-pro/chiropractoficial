-- ============================================
-- 008_notification_helpers.sql
-- RPCs auxiliares para n8n: claim de jobs, upsert de conversaciones, log de mensajes,
-- y matching de embeddings ya en 007. Este migration añade lo que falta.
-- ============================================

-- Devuelve y "claim" jobs pendientes en una sola operación atómica.
-- El workflow de n8n los toma, los procesa y los marca como sent/failed.
CREATE OR REPLACE FUNCTION public.notification_jobs_due(p_limit INT DEFAULT 50)
RETURNS SETOF notification_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  UPDATE notification_jobs
  SET status = 'processing', updated_at = NOW()
  WHERE id IN (
    SELECT id FROM notification_jobs
    WHERE status = 'scheduled'
      AND scheduled_for <= NOW()
      AND attempts < 5
    ORDER BY scheduled_for ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.notification_jobs_due(INT) TO service_role;

-- Upsert de conversación + retorna el ID (para n8n que necesita conversation_id)
CREATE OR REPLACE FUNCTION public.upsert_whatsapp_conversation(
  p_tenant_id UUID,
  p_phone TEXT,
  p_patient_id UUID DEFAULT NULL,
  p_evolution_instance_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO whatsapp_conversations (tenant_id, phone, patient_id, evolution_instance_id)
  VALUES (p_tenant_id, p_phone, p_patient_id, p_evolution_instance_id)
  ON CONFLICT (tenant_id, phone) DO UPDATE
    SET patient_id = COALESCE(whatsapp_conversations.patient_id, EXCLUDED.patient_id),
        evolution_instance_id = COALESCE(EXCLUDED.evolution_instance_id, whatsapp_conversations.evolution_instance_id),
        state = CASE WHEN whatsapp_conversations.state = 'archived' THEN 'active' ELSE whatsapp_conversations.state END
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_conversation(UUID, TEXT, UUID, TEXT) TO service_role, authenticated;

-- Resuelve un teléfono entrante a paciente/tenant (para inbound del bot).
-- Si no encuentra paciente, igual devuelve el primer tenant con ese phone normalizado.
CREATE OR REPLACE FUNCTION public.resolve_inbound_phone(p_phone TEXT)
RETURNS TABLE (
  tenant_id UUID,
  patient_id UUID,
  patient_name TEXT,
  conversation_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');
  -- quita prefijo 57 si aparece doble
  IF length(v_normalized) > 10 AND v_normalized LIKE '57%' THEN
    v_normalized := substring(v_normalized FROM 3);
  END IF;

  RETURN QUERY
  SELECT
    p.tenant_id,
    p.id AS patient_id,
    p.full_name AS patient_name,
    public.upsert_whatsapp_conversation(p.tenant_id, v_normalized, p.id, NULL) AS conversation_id
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
     OR v_normalized LIKE '%' || regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')
  ORDER BY length(p.phone) DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_inbound_phone(TEXT) TO service_role, authenticated;

-- Devuelve los últimos N mensajes de una conversación (memoria del bot).
CREATE OR REPLACE FUNCTION public.recent_conversation_messages(
  p_conversation_id UUID,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT role, content, created_at
  FROM (
    SELECT role, content, created_at
    FROM whatsapp_messages
    WHERE conversation_id = p_conversation_id
    ORDER BY created_at DESC
    LIMIT p_limit
  ) t
  ORDER BY created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.recent_conversation_messages(UUID, INT) TO service_role, authenticated;
