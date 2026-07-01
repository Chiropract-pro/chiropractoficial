-- ============================================
-- 007_whatsapp_and_rag.sql
-- Bot WhatsApp con memoria persistente + RAG sobre historia clínica.
-- Tablas:
--   - whatsapp_conversations: una conversación por (tenant, paciente_phone)
--   - whatsapp_messages: cada mensaje enviado/recibido
--   - notification_jobs: cola de notificaciones programadas (T-24h, post-cita, etc)
--   - notification_templates: plantillas de mensajes editables sin redeploy
--   - clinical_embeddings: chunks de historia clínica vectorizados (pgvector)
-- ============================================

-- pgvector para búsqueda semántica (RAG)
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- 1. WHATSAPP CONVERSATIONS
-- ============================================
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  evolution_instance_id TEXT,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'paused', 'archived', 'escalated_to_human')),
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_inbound_at TIMESTAMPTZ,
  last_outbound_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, phone)
);

-- ============================================
-- 2. WHATSAPP MESSAGES
-- ============================================
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'template', 'location', 'contact')),
  evolution_message_id TEXT,
  template_key TEXT,
  related_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  related_sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. NOTIFICATION JOBS (cola de envíos programados)
-- ============================================
CREATE TABLE notification_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE,
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email', 'sms')),
  template_key TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sent', 'failed', 'cancelled')),
  attempts INT DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. NOTIFICATION TEMPLATES (editables sin redeploy)
-- ============================================
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  body TEXT NOT NULL,
  description TEXT,
  variables JSONB DEFAULT '[]'::jsonb,
  active BOOLEAN DEFAULT TRUE,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, key, channel)
);

-- ============================================
-- 5. CLINICAL EMBEDDINGS (RAG sobre historia clínica)
-- ============================================
CREATE TABLE clinical_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('appointment_note', 'patient_note', 'sale_summary', 'consultation', 'manual')),
  source_id UUID,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_embeddings ENABLE ROW LEVEL SECURITY;

-- WhatsApp conversations
CREATE POLICY "Tenant members can view whatsapp_conversations" ON whatsapp_conversations
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert whatsapp_conversations" ON whatsapp_conversations
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update whatsapp_conversations" ON whatsapp_conversations
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete whatsapp_conversations" ON whatsapp_conversations
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- WhatsApp messages
CREATE POLICY "Tenant members can view whatsapp_messages" ON whatsapp_messages
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert whatsapp_messages" ON whatsapp_messages
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update whatsapp_messages" ON whatsapp_messages
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete whatsapp_messages" ON whatsapp_messages
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Notification jobs
CREATE POLICY "Tenant members can view notification_jobs" ON notification_jobs
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert notification_jobs" ON notification_jobs
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update notification_jobs" ON notification_jobs
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete notification_jobs" ON notification_jobs
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Notification templates (también accesible para tenant_id NULL = plantillas globales del SaaS)
CREATE POLICY "Members can view templates" ON notification_templates
  FOR SELECT USING (tenant_id IS NULL OR public.is_tenant_member(tenant_id));
CREATE POLICY "Members can manage own templates" ON notification_templates
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Members can update own templates" ON notification_templates
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Members can delete own templates" ON notification_templates
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Clinical embeddings
CREATE POLICY "Tenant members can view clinical_embeddings" ON clinical_embeddings
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert clinical_embeddings" ON clinical_embeddings
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update clinical_embeddings" ON clinical_embeddings
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete clinical_embeddings" ON clinical_embeddings
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_jobs_updated_at
  BEFORE UPDATE ON notification_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Trigger que actualiza last_message_at cuando llega un mensaje nuevo
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE whatsapp_conversations
  SET last_message_at = NEW.created_at,
      last_inbound_at = CASE WHEN NEW.direction = 'inbound' THEN NEW.created_at ELSE last_inbound_at END,
      last_outbound_at = CASE WHEN NEW.direction = 'outbound' THEN NEW.created_at ELSE last_outbound_at END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER whatsapp_messages_update_conversation
  AFTER INSERT ON whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_last_message();

-- ============================================
-- HELPER FUNCTIONS para n8n
-- ============================================

-- Programa recordatorios T-24h y T-2h cuando se crea/actualiza una cita
CREATE OR REPLACE FUNCTION public.schedule_appointment_reminders(p_appointment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_appt appointments%ROWTYPE;
  v_when TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_appt FROM appointments WHERE id = p_appointment_id;
  IF NOT FOUND OR v_appt.status IN ('cancelada', 'completada', 'no_asistio') THEN
    RETURN;
  END IF;

  v_when := (v_appt.date::TEXT || ' ' || v_appt.time::TEXT)::TIMESTAMPTZ;

  -- T-24h
  INSERT INTO notification_jobs (tenant_id, patient_id, appointment_id, channel, template_key, scheduled_for, payload)
  VALUES (
    v_appt.tenant_id, v_appt.patient_id, v_appt.id, 'whatsapp', 'reminder_24h',
    v_when - INTERVAL '24 hours',
    jsonb_build_object('appointment_id', v_appt.id, 'date', v_appt.date, 'time', v_appt.time)
  )
  ON CONFLICT DO NOTHING;

  -- T-2h
  INSERT INTO notification_jobs (tenant_id, patient_id, appointment_id, channel, template_key, scheduled_for, payload)
  VALUES (
    v_appt.tenant_id, v_appt.patient_id, v_appt.id, 'whatsapp', 'reminder_2h',
    v_when - INTERVAL '2 hours',
    jsonb_build_object('appointment_id', v_appt.id, 'date', v_appt.date, 'time', v_appt.time)
  )
  ON CONFLICT DO NOTHING;
END;
$$;

-- Trigger para programar recordatorios automáticamente al crear cita
CREATE OR REPLACE FUNCTION public.auto_schedule_reminders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.status IN ('pendiente', 'confirmada') THEN
    PERFORM public.schedule_appointment_reminders(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointment_auto_schedule_reminders
  AFTER INSERT ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.auto_schedule_reminders();

-- Función para n8n: obtener próxima cita de un paciente por su teléfono
CREATE OR REPLACE FUNCTION public.next_appointment_by_phone(p_phone TEXT)
RETURNS TABLE (
  appointment_id UUID,
  tenant_id UUID,
  patient_id UUID,
  patient_name TEXT,
  appointment_date DATE,
  appointment_time TIME,
  appointment_type TEXT,
  location TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.tenant_id, a.patient_id, a.patient_name,
         a.date, a.time, a.type, a.location, a.status
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE regexp_replace(p.phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    AND a.date >= CURRENT_DATE
    AND a.status IN ('pendiente', 'confirmada')
  ORDER BY a.date ASC, a.time ASC
  LIMIT 1;
END;
$$;

-- Función RPC para n8n: matching de embeddings (RAG)
CREATE OR REPLACE FUNCTION public.match_clinical_embeddings(
  query_embedding vector(1536),
  p_patient_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  source_type TEXT,
  similarity FLOAT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT
    ce.id,
    ce.content,
    ce.source_type,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM clinical_embeddings ce
  WHERE ce.patient_id = p_patient_id
    AND ce.embedding IS NOT NULL
  ORDER BY ce.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.next_appointment_by_phone(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_clinical_embeddings(vector, UUID, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.schedule_appointment_reminders(UUID) TO authenticated, service_role;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_whatsapp_conversations_tenant ON whatsapp_conversations(tenant_id);
CREATE INDEX idx_whatsapp_conversations_phone ON whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_conversations_patient ON whatsapp_conversations(patient_id);
CREATE INDEX idx_whatsapp_conversations_state ON whatsapp_conversations(state) WHERE state != 'archived';

CREATE INDEX idx_whatsapp_messages_conv ON whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX idx_whatsapp_messages_tenant ON whatsapp_messages(tenant_id);

CREATE INDEX idx_notification_jobs_pending ON notification_jobs(scheduled_for) WHERE status = 'scheduled';
CREATE INDEX idx_notification_jobs_tenant ON notification_jobs(tenant_id);
CREATE INDEX idx_notification_jobs_appointment ON notification_jobs(appointment_id);

CREATE INDEX idx_notification_templates_key ON notification_templates(tenant_id, key, channel);

CREATE INDEX idx_clinical_embeddings_patient ON clinical_embeddings(patient_id);
CREATE INDEX idx_clinical_embeddings_vector ON clinical_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
