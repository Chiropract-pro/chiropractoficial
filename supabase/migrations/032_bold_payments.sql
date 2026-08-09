-- ============================================
-- 032_bold_payments.sql
-- Pagos en línea con BOLD (bold.co, Colombia) — segunda pasarela junto a Wompi.
--
-- Reutiliza la tabla `payments` existente (ya tiene columna `provider`), de modo
-- que el CRM ve TODOS los cobros en un solo lugar sin importar la pasarela.
--
-- Añade:
--   - bold_events       : log crudo de webhooks recibidos (auditoría, igual que wompi_events)
--   - apply_bold_event  : aplica el evento -> actualiza payment, crea la venta y
--                         programa el recibo por WhatsApp (espejo de apply_wompi_event)
--
-- Eventos de Bold: SALE_APPROVED · SALE_REJECTED · VOID_APPROVED · VOID_REJECTED
-- La referencia propia viaja en data.metadata.reference.
-- ============================================

-- ---- 1. Log de eventos de Bold (auditoría) --------------------------------
CREATE TABLE IF NOT EXISTS bold_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT,                       -- id del evento (para idempotencia)
  event_type TEXT NOT NULL,            -- SALE_APPROVED, etc.
  payment_id TEXT,                     -- id de la transacción en Bold
  reference TEXT,                      -- nuestra referencia (metadata.reference)
  raw_payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bold_events_ref ON bold_events(reference);
-- Idempotencia: Bold puede reintentar el mismo evento.
CREATE UNIQUE INDEX IF NOT EXISTS ux_bold_events_event_id
  ON bold_events(event_id) WHERE event_id IS NOT NULL;

ALTER TABLE bold_events ENABLE ROW LEVEL SECURITY;
-- Sin policies: solo service_role (Edge Functions) escribe/lee. Igual que wompi_events.

-- ---- 2. Aplicar un evento de Bold -----------------------------------------
CREATE OR REPLACE FUNCTION public.apply_bold_event(
  p_event_type TEXT,
  p_payment_id TEXT,
  p_reference TEXT,
  p_amount BIGINT,
  p_payment_method TEXT,
  p_raw JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_new_status TEXT;
  v_sale_id UUID;
BEGIN
  -- Mapear el evento de Bold a nuestro enum de status
  v_new_status := CASE upper(p_event_type)
    WHEN 'SALE_APPROVED'  THEN 'approved'
    WHEN 'SALE_REJECTED'  THEN 'declined'
    WHEN 'VOID_APPROVED'  THEN 'voided'
    WHEN 'VOID_REJECTED'  THEN NULL      -- la anulación falló: el pago sigue como estaba
    ELSE NULL
  END;

  IF v_new_status IS NULL THEN
    RETURN NULL;                          -- evento informativo, nada que aplicar
  END IF;

  SELECT * INTO v_payment FROM payments WHERE reference = p_reference;

  IF NOT FOUND THEN
    RAISE WARNING 'Bold: payment con reference % no encontrado, se ignora', p_reference;
    RETURN NULL;
  END IF;

  -- Idempotencia: si ya está en el mismo estado final, no reprocesar
  IF v_payment.status IN ('approved', 'declined', 'voided')
     AND v_new_status = v_payment.status THEN
    RETURN v_payment.id;
  END IF;

  UPDATE payments
  SET status = v_new_status,
      provider = 'bold',
      provider_transaction_id = COALESCE(p_payment_id, provider_transaction_id),
      payment_method = COALESCE(p_payment_method, payment_method),
      paid_at = CASE WHEN v_new_status = 'approved' THEN NOW() ELSE paid_at END,
      metadata = metadata || p_raw,
      updated_at = NOW()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- Aprobado -> crear la venta automáticamente (igual que con Wompi)
  IF v_new_status = 'approved' AND v_payment.sale_id IS NULL THEN
    INSERT INTO sales (
      tenant_id, patient_id, appointment_id, jornada_id,
      total, payment_method, status, notes
    )
    VALUES (
      v_payment.tenant_id, v_payment.patient_id, v_payment.appointment_id, v_payment.jornada_id,
      v_payment.amount, 'tarjeta', 'completada',
      'Pago automático vía Bold (' || COALESCE(p_payment_method, 'online') || ')'
    )
    RETURNING id INTO v_sale_id;

    UPDATE payments SET sale_id = v_sale_id WHERE id = v_payment.id;

    -- Si el pago salda una cita, marcarla como completada
    IF v_payment.appointment_id IS NOT NULL THEN
      UPDATE appointments
      SET status = 'completada', updated_at = NOW()
      WHERE id = v_payment.appointment_id
        AND status IN ('pendiente', 'confirmada');
    END IF;

    -- Recibo por WhatsApp (lo despacha el cron de notificaciones)
    INSERT INTO notification_jobs (
      tenant_id, patient_id, sale_id, channel, template_key, scheduled_for, payload
    )
    VALUES (
      v_payment.tenant_id, v_payment.patient_id, v_sale_id,
      'whatsapp', 'post_appointment_receipt', NOW() + INTERVAL '30 seconds',
      jsonb_build_object(
        'sale_id', v_sale_id,
        'sale_total', to_char(v_payment.amount, 'FM$999G999G999'),
        'items_summary', COALESCE(v_payment.description, 'Pago en línea'),
        'receipt_url', ''
      )
    );
  END IF;

  RETURN v_payment.id;
END;
$$;

-- Solo el backend (Edge Function del webhook) puede aplicarlo.
REVOKE EXECUTE ON FUNCTION public.apply_bold_event(TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.apply_bold_event(TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB) TO service_role;

COMMENT ON FUNCTION public.apply_bold_event IS
  'Aplica un evento de webhook de Bold: actualiza el payment, crea la venta, cierra la cita y programa el recibo.';
