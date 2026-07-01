-- ============================================
-- 009_post_appointment_jobs.sql
-- Programa job de "post-cita con recibo" cuando se registra una venta
-- asociada a una cita completada. Reutiliza el workflow #1 de n8n
-- (cron de notification_jobs) — no se necesita un workflow #3 separado.
-- ============================================

CREATE OR REPLACE FUNCTION public.schedule_post_sale_receipt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_items_summary TEXT;
BEGIN
  -- Solo si la venta es 'completada' y tiene paciente
  IF NEW.status <> 'completada' OR NEW.patient_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resumen de items (concatena nombres)
  SELECT string_agg(item_name || (CASE WHEN quantity > 1 THEN ' x' || quantity ELSE '' END), ', ')
  INTO v_items_summary
  FROM sale_items
  WHERE sale_id = NEW.id;

  -- Programar envío en 5 minutos (da tiempo a que el recibo PDF se genere)
  INSERT INTO notification_jobs (
    tenant_id, patient_id, sale_id, channel, template_key, scheduled_for, payload
  )
  VALUES (
    NEW.tenant_id,
    NEW.patient_id,
    NEW.id,
    'whatsapp',
    'post_appointment_receipt',
    NOW() + INTERVAL '5 minutes',
    jsonb_build_object(
      'sale_id', NEW.id,
      'sale_total', to_char(NEW.total, 'FM$999G999G999'),
      'items_summary', COALESCE(v_items_summary, ''),
      'receipt_url', '' -- se completa al rendirizar plantilla con la Edge Function
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_post_receipt ON sales;
CREATE TRIGGER sales_post_receipt
  AFTER INSERT OR UPDATE OF status ON sales
  FOR EACH ROW EXECUTE FUNCTION public.schedule_post_sale_receipt();
