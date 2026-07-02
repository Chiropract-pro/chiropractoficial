-- ============================================
-- 028_email_log.sql
-- Registro de correos enviados vía la función send-email (Resend).
-- Sirve para auditoría, depuración e idempotencia (evitar reenvíos).
-- Solo el backend (service_role) escribe/lee; sin acceso público.
-- ============================================

CREATE TABLE IF NOT EXISTS email_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,               -- 'welcome', 'team_invite', 'directory_invite', ...
  to_email TEXT NOT NULL,
  subject TEXT,
  resend_id TEXT,                   -- id que devuelve Resend
  meta JSONB,                       -- contexto opcional (tenant_id, invitation_id, etc.)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_log_to ON email_log (to_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log (type, created_at DESC);

-- RLS: nadie por API pública. Solo service_role (que bypassa RLS) escribe/lee.
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
-- (Sin policies = sin acceso para anon/authenticated; service_role ignora RLS.)
