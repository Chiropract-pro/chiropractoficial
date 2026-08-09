-- ============================================
-- 035_notifications_cron.sql
-- Despacho automático de recordatorios de cita y recibos, DENTRO de Supabase.
--
-- POR QUÉ
-- El despacho vivía en un workflow de n8n que apunta al proyecto Supabase
-- ANTERIOR (onwgfixvbyknotnbrkgr), muerto desde el cambio de infraestructura del
-- 1-jul. Por eso los recordatorios y recibos que promete la landing nunca salían.
-- Con esto el sistema es autónomo: no depende de n8n ni de ningún servidor extra.
--
-- Cada 5 minutos pg_cron invoca la Edge Function `notifications-dispatch`, que
-- reclama los jobs vencidos y los envía por email (Resend) o WhatsApp (Evolution).
--
-- SEGURIDAD: no se escribe ningún secreto aquí. El cron usa un secreto dedicado
-- (`cron_secret`, de menor privilegio que la service_role) leído del Vault de
-- Supabase, donde se guardó una sola vez con:
--   SELECT vault.create_secret('<valor>', 'cron_secret', '...');
-- y que además está configurado como secreto CRON_SECRET de las Edge Functions.
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Idempotente: si ya existe la tarea, se reemplaza.
SELECT cron.unschedule('dispatch-notifications')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dispatch-notifications');

SELECT cron.schedule(
  'dispatch-notifications',
  '*/5 * * * *',                      -- cada 5 minutos
  $$
  SELECT net.http_post(
    url     := 'https://dqxffnibxizlfaeddzrz.supabase.co/functions/v1/notifications-dispatch',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (
                   SELECT decrypted_secret FROM vault.decrypted_secrets
                   WHERE name = 'cron_secret' LIMIT 1
                 )
               ),
    body    := '{}'::jsonb
  );
  $$
);
