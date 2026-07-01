-- ============================================
-- 023_apply_wompi_subscriptions.sql
-- Actualiza apply_wompi_event para diferenciar:
--   - purpose='sale' → crea sales row (comportamiento original)
--   - purpose='subscription_*' → llama subscription_apply_payment
-- ============================================

CREATE OR REPLACE FUNCTION public.apply_wompi_event(
  p_event_type TEXT,
  p_transaction_id TEXT,
  p_reference TEXT,
  p_status TEXT,
  p_payment_method TEXT,
  p_amount_in_cents BIGINT,
  p_customer_email TEXT,
  p_raw JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_new_status TEXT;
  v_sale_id UUID;
BEGIN
  v_new_status := CASE upper(p_status)
    WHEN 'APPROVED' THEN 'approved'
    WHEN 'DECLINED' THEN 'declined'
    WHEN 'VOIDED' THEN 'voided'
    WHEN 'ERROR' THEN 'error'
    WHEN 'PENDING' THEN 'pending'
    ELSE 'pending'
  END;

  SELECT * INTO v_payment FROM payments WHERE reference = p_reference;

  IF NOT FOUND THEN
    RAISE WARNING 'Payment with reference % not found, ignoring event', p_reference;
    RETURN NULL;
  END IF;

  -- Idempotencia
  IF v_payment.status IN ('approved', 'declined', 'voided') AND v_new_status = v_payment.status THEN
    RETURN v_payment.id;
  END IF;

  UPDATE payments
  SET status = v_new_status,
      provider_transaction_id = COALESCE(p_transaction_id, provider_transaction_id),
      payment_method = COALESCE(p_payment_method, payment_method),
      paid_at = CASE WHEN v_new_status = 'approved' THEN NOW() ELSE paid_at END,
      metadata = metadata || p_raw,
      updated_at = NOW()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  -- =====================
  -- Branch por purpose
  -- =====================
  IF v_new_status = 'approved' THEN
    IF v_payment.purpose IN ('subscription_initial', 'subscription_renewal') AND v_payment.subscription_id IS NOT NULL THEN
      -- Pago de suscripción → extender período
      PERFORM public.subscription_apply_payment(v_payment.subscription_id, v_payment.id);

    ELSIF v_payment.sale_id IS NULL THEN
      -- Pago de venta normal → crear sale (lógica original)
      INSERT INTO sales (
        tenant_id, patient_id, appointment_id, jornada_id,
        total, payment_method, status, notes
      )
      VALUES (
        v_payment.tenant_id,
        v_payment.patient_id,
        v_payment.appointment_id,
        v_payment.jornada_id,
        v_payment.amount,
        'tarjeta',
        'completada',
        'Pago automático vía Wompi (' || COALESCE(p_payment_method, 'online') || ')'
      )
      RETURNING id INTO v_sale_id;

      UPDATE payments SET sale_id = v_sale_id WHERE id = v_payment.id;

      INSERT INTO notification_jobs (
        tenant_id, patient_id, sale_id, channel, template_key, scheduled_for, payload
      )
      VALUES (
        v_payment.tenant_id,
        v_payment.patient_id,
        v_sale_id,
        'whatsapp',
        'post_appointment_receipt',
        NOW() + INTERVAL '30 seconds',
        jsonb_build_object(
          'sale_id', v_sale_id,
          'sale_total', to_char(v_payment.amount, 'FM$999G999G999'),
          'items_summary', COALESCE(v_payment.description, 'Pago en línea'),
          'receipt_url', ''
        )
      );
    END IF;
  END IF;

  RETURN v_payment.id;
END;
$$;

-- También extender create_payment_intent para aceptar subscription_id + purpose
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_tenant_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_jornada_id UUID DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_subscription_id UUID DEFAULT NULL,
  p_purpose TEXT DEFAULT 'sale'
)
RETURNS payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_reference TEXT;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Monto inválido'; END IF;

  v_reference := 'chiro-' || encode(gen_random_bytes(8), 'hex') || '-' || extract(epoch from NOW())::BIGINT;

  INSERT INTO payments (
    tenant_id, reference, patient_id, appointment_id, jornada_id,
    amount, currency, description,
    customer_email, customer_phone,
    subscription_id, purpose,
    status, expires_at
  )
  VALUES (
    p_tenant_id, v_reference, p_patient_id, p_appointment_id, p_jornada_id,
    p_amount, 'COP', p_description,
    p_customer_email, p_customer_phone,
    p_subscription_id, p_purpose,
    'pending', NOW() + INTERVAL '24 hours'
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(
  UUID, BIGINT, TEXT, UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT
) TO service_role, authenticated;
