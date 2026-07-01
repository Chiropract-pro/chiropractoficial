-- ============================================
-- 010_wompi_payments.sql
-- Pagos en línea con Wompi (Bancolombia, Colombia).
-- Tablas:
--   - payments: cada intento de cobro (pending, approved, declined, voided)
--   - wompi_events: log raw de eventos recibidos del webhook (auditoría)
-- Funciones:
--   - apply_wompi_event: dado un evento de Wompi, actualiza payment y crea sale si APPROVED
-- ============================================

-- ============================================
-- 1. PAYMENTS (pagos en línea / Wompi)
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE SET NULL,
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'COP',
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined', 'voided', 'error', 'expired')),
  provider TEXT NOT NULL DEFAULT 'wompi',
  provider_transaction_id TEXT,
  provider_payment_link_id TEXT,
  payment_url TEXT,
  payment_method TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_tenant ON payments(tenant_id);
CREATE INDEX idx_payments_status ON payments(tenant_id, status);
CREATE INDEX idx_payments_provider_tx ON payments(provider_transaction_id);
CREATE INDEX idx_payments_reference ON payments(reference);

-- ============================================
-- 2. WOMPI EVENTS (auditoría completa de webhooks recibidos)
-- ============================================
CREATE TABLE wompi_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  reference TEXT,
  raw_payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processing_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wompi_events_tenant ON wompi_events(tenant_id);
CREATE INDEX idx_wompi_events_tx ON wompi_events(transaction_id);
CREATE INDEX idx_wompi_events_processed ON wompi_events(processed) WHERE processed = FALSE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE wompi_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view payments" ON payments
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert payments" ON payments
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update payments" ON payments
  FOR UPDATE USING (public.is_tenant_member(tenant_id));

-- wompi_events: solo lectura para members; escritura solo via service_role (Edge Function)
CREATE POLICY "Tenant members can view wompi_events" ON wompi_events
  FOR SELECT USING (public.is_tenant_member(tenant_id));

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RPC: aplicar evento Wompi (mueve payment + crea sale si APPROVED)
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
  -- Mapear status de Wompi a nuestro enum
  v_new_status := CASE upper(p_status)
    WHEN 'APPROVED' THEN 'approved'
    WHEN 'DECLINED' THEN 'declined'
    WHEN 'VOIDED' THEN 'voided'
    WHEN 'ERROR' THEN 'error'
    WHEN 'PENDING' THEN 'pending'
    ELSE 'pending'
  END;

  -- Buscar payment por reference (que generamos al crear la transacción)
  SELECT * INTO v_payment FROM payments WHERE reference = p_reference;

  IF NOT FOUND THEN
    RAISE WARNING 'Payment with reference % not found, ignoring event', p_reference;
    RETURN NULL;
  END IF;

  -- Idempotencia: si ya está en estado final, no reprocesamos
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

  -- Si fue APPROVED, crear sale automática
  IF v_new_status = 'approved' AND v_payment.sale_id IS NULL THEN
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

    -- Programar mensaje de confirmación + recibo (lo despacha el cron de notificaciones)
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

  RETURN v_payment.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_wompi_event(TEXT, TEXT, TEXT, TEXT, TEXT, BIGINT, TEXT, JSONB) TO service_role;

-- ============================================
-- RPC: crear payment con reference única (lo llama la Edge Function)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_tenant_id UUID,
  p_amount BIGINT,
  p_description TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_jornada_id UUID DEFAULT NULL,
  p_customer_email TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL
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
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount debe ser > 0';
  END IF;

  -- Reference única: chiro-<short tenant>-<timestamp>-<random>
  v_reference := 'chiro-' || substring(p_tenant_id::TEXT, 1, 8) || '-'
              || extract(epoch from NOW())::BIGINT || '-'
              || substring(md5(random()::TEXT), 1, 6);

  INSERT INTO payments (
    tenant_id, reference, amount, description,
    patient_id, appointment_id, jornada_id,
    customer_email, customer_phone
  )
  VALUES (
    p_tenant_id, v_reference, p_amount, p_description,
    p_patient_id, p_appointment_id, p_jornada_id,
    p_customer_email, p_customer_phone
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_payment_intent(UUID, BIGINT, TEXT, UUID, UUID, UUID, TEXT, TEXT) TO service_role, authenticated;
