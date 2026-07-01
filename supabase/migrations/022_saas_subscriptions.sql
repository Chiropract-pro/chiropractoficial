-- ============================================
-- 022_saas_subscriptions.sql
-- FASE 5 — SaaS comercial multi-consultorio
--
-- Modelo de cobro:
--   - Auto-renovación vía Wompi payment links (1 mes / 1 año por click)
--   - Webhook actualiza tenant_subscriptions y extiende current_period_end
--   - Plan limits (pacientes, usuarios) enforce vía RPC
--   - Trial automático de 14 días al crear tenant (default existente)
-- ============================================

-- ============================================
-- 1. Tabla plans — catálogo de planes (seed inmutable, app reads this)
-- ============================================
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  price_cop_monthly BIGINT NOT NULL DEFAULT 0,
  price_cop_yearly BIGINT,             -- typically 10x monthly (2 meses gratis)
  max_patients INT,                     -- NULL = ilimitado
  max_users INT,                        -- NULL = ilimitado
  max_storage_mb INT,                   -- NULL = ilimitado
  features JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["WhatsApp Bot", "Facturación DIAN", ...]
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  badge TEXT,                            -- "MÁS POPULAR", "PROMO", null
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed de planes (idempotente)
INSERT INTO plans (id, name, tagline, price_cop_monthly, price_cop_yearly,
                   max_patients, max_users, max_storage_mb, features, is_public, display_order, badge)
VALUES
  ('trial', 'Prueba', 'Para probar el sistema',
   0, NULL,
   50, 2, 200,
   '["Acceso completo 14 días", "Hasta 50 pacientes", "Hasta 2 usuarios"]'::jsonb,
   FALSE, 0, NULL),

  ('basic', 'Básico', 'Para consultorios independientes',
   199000, 1990000,
   200, 3, 2048,
   '["Hasta 200 pacientes", "Hasta 3 usuarios (doctor + asistentes)", "Historia clínica completa", "Citas + WhatsApp Bot", "Recordatorios automáticos", "Pagos en línea (Wompi)", "Panel del paciente", "Soporte por email"]'::jsonb,
   TRUE, 1, NULL),

  ('pro', 'Pro', 'Para consultorios en crecimiento',
   399000, 3990000,
   1000, 10, 10240,
   '["Hasta 1.000 pacientes", "Hasta 10 usuarios", "Todo lo del plan Básico", "Facturación electrónica DIAN", "Multi-doctor con agendas separadas", "Jornadas itinerantes ilimitadas", "Reportes avanzados de finanzas", "PWA mobile + offline", "Soporte prioritario WhatsApp"]'::jsonb,
   TRUE, 2, 'MÁS POPULAR'),

  ('enterprise', 'Enterprise', 'Para clínicas y cadenas',
   0, 0,
   NULL, NULL, NULL,
   '["Pacientes ilimitados", "Usuarios ilimitados", "Multi-sede", "Subdominio o dominio propio", "White-label (tu logo y colores)", "API personalizada", "Onboarding y capacitación", "Soporte dedicado"]'::jsonb,
   TRUE, 3, NULL)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  tagline = EXCLUDED.tagline,
  price_cop_monthly = EXCLUDED.price_cop_monthly,
  price_cop_yearly = EXCLUDED.price_cop_yearly,
  max_patients = EXCLUDED.max_patients,
  max_users = EXCLUDED.max_users,
  max_storage_mb = EXCLUDED.max_storage_mb,
  features = EXCLUDED.features,
  is_public = EXCLUDED.is_public,
  display_order = EXCLUDED.display_order,
  badge = EXCLUDED.badge;

-- Read-only para anon (la landing pública lee precios)
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans_public_read" ON plans;
CREATE POLICY "plans_public_read" ON plans
  FOR SELECT TO anon, authenticated
  USING (is_public = TRUE);

-- ============================================
-- 2. tenant_subscriptions — registro de suscripción activa por tenant
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),

  status TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'pending_payment', 'active', 'past_due', 'cancelled', 'expired')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly')),

  current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMPTZ NOT NULL,

  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,

  -- Wompi tracking
  last_payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_tenant ON tenant_subscriptions(tenant_id, current_period_end DESC);
CREATE INDEX IF NOT EXISTS idx_subs_status ON tenant_subscriptions(status, current_period_end);

DROP TRIGGER IF EXISTS subs_updated_at ON tenant_subscriptions;
CREATE TRIGGER subs_updated_at
  BEFORE UPDATE ON tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE tenant_subscriptions ENABLE ROW LEVEL SECURITY;

-- Solo owner/admin del tenant pueden ver su suscripción
DROP POLICY IF EXISTS "subs_owner_admin" ON tenant_subscriptions;
CREATE POLICY "subs_owner_admin" ON tenant_subscriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
    )
  );

-- ============================================
-- 3. ALTER payments — link a subscription_id
-- ============================================
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purpose TEXT NOT NULL DEFAULT 'sale'
    CHECK (purpose IN ('sale', 'subscription_renewal', 'subscription_initial'));

CREATE INDEX IF NOT EXISTS idx_payments_subscription ON payments(subscription_id) WHERE subscription_id IS NOT NULL;

-- ============================================
-- 4. Trigger: al crear tenant, insertar subscription en plan 'trial'
-- ============================================
CREATE OR REPLACE FUNCTION public.tg_tenant_create_trial()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO tenant_subscriptions (
    tenant_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end
  )
  VALUES (
    NEW.id, 'trial', 'trial', 'monthly',
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tenants_create_trial ON tenants;
CREATE TRIGGER tenants_create_trial
  AFTER INSERT ON tenants
  FOR EACH ROW EXECUTE FUNCTION public.tg_tenant_create_trial();

-- Backfill: tenants existentes sin subscription -> crear trial extendido
INSERT INTO tenant_subscriptions (tenant_id, plan_id, status, billing_cycle,
                                  current_period_start, current_period_end)
SELECT t.id, 'trial', 'trial', 'monthly', NOW(), NOW() + INTERVAL '60 days'
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_subscriptions s WHERE s.tenant_id = t.id
)
ON CONFLICT DO NOTHING;

-- ============================================
-- 5. View: tenant_current_subscription — última suscripción + plan info
-- ============================================
CREATE OR REPLACE VIEW public.tenant_current_subscription AS
SELECT
  s.id AS subscription_id,
  s.tenant_id,
  s.plan_id,
  s.status,
  s.billing_cycle,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  GREATEST(0, EXTRACT(EPOCH FROM (s.current_period_end - NOW()))::BIGINT / 86400) AS days_remaining,
  p.name AS plan_name,
  p.tagline AS plan_tagline,
  p.price_cop_monthly,
  p.price_cop_yearly,
  p.max_patients,
  p.max_users,
  p.max_storage_mb,
  p.features
FROM tenant_subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.id = (
  SELECT id FROM tenant_subscriptions s2
  WHERE s2.tenant_id = s.tenant_id
  ORDER BY s2.current_period_end DESC
  LIMIT 1
);

GRANT SELECT ON public.tenant_current_subscription TO authenticated;

-- ============================================
-- 6. RPC: tenant_check_plan_limit
-- Retorna { can_add, current, max, plan_id, status } para enforcement en UI
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_check_plan_limit(
  p_tenant_id UUID,
  p_resource TEXT  -- 'patients' | 'users'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sub RECORD;
  v_current INT;
  v_max INT;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  -- Verifica membership
  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Sin acceso al tenant';
  END IF;

  SELECT plan_id, status, max_patients, max_users
  INTO v_sub
  FROM tenant_current_subscription
  WHERE tenant_id = p_tenant_id;

  -- Si la suscripción está expirada/cancelada — no permitir nada nuevo
  IF v_sub.status IN ('expired', 'cancelled') THEN
    RETURN json_build_object(
      'can_add', FALSE,
      'reason', 'subscription_inactive',
      'plan_id', v_sub.plan_id,
      'status', v_sub.status
    );
  END IF;

  IF p_resource = 'patients' THEN
    SELECT COUNT(*) INTO v_current FROM patients WHERE tenant_id = p_tenant_id;
    v_max := v_sub.max_patients;
  ELSIF p_resource = 'users' THEN
    SELECT COUNT(*) INTO v_current FROM tenant_memberships
    WHERE tenant_id = p_tenant_id AND accepted_at IS NOT NULL;
    v_max := v_sub.max_users;
  ELSE
    RAISE EXCEPTION 'Recurso no soportado: %', p_resource;
  END IF;

  RETURN json_build_object(
    'can_add', (v_max IS NULL OR v_current < v_max),
    'current', v_current,
    'max', v_max,
    'plan_id', v_sub.plan_id,
    'status', v_sub.status,
    'resource', p_resource
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_check_plan_limit(UUID, TEXT) TO authenticated;

-- ============================================
-- 7. RPC: tenant_request_plan_upgrade
-- Crea un payment intent de Wompi para activar/renovar plan.
-- Devuelve {payment_id, reference, amount} — el frontend luego llama
-- wompi-create-link Edge Function con purpose='subscription_initial'.
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_request_plan_upgrade(
  p_tenant_id UUID,
  p_plan_id TEXT,
  p_billing_cycle TEXT DEFAULT 'monthly'  -- 'monthly' | 'yearly'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_plan RECORD;
  v_amount BIGINT;
  v_subscription_id UUID;
  v_period_end TIMESTAMPTZ;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id
      AND role = 'owner' AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo el owner puede cambiar el plan';
  END IF;

  SELECT * INTO v_plan FROM plans WHERE id = p_plan_id;
  IF v_plan.id IS NULL THEN RAISE EXCEPTION 'Plan no existe'; END IF;

  IF p_plan_id = 'trial' THEN
    RAISE EXCEPTION 'No se puede comprar el plan trial';
  END IF;

  IF p_plan_id = 'enterprise' THEN
    RAISE EXCEPTION 'Para Enterprise contacta directamente al equipo';
  END IF;

  -- Calcular monto
  IF p_billing_cycle = 'yearly' THEN
    v_amount := COALESCE(v_plan.price_cop_yearly, v_plan.price_cop_monthly * 12);
    v_period_end := NOW() + INTERVAL '1 year';
  ELSE
    v_amount := v_plan.price_cop_monthly;
    v_period_end := NOW() + INTERVAL '1 month';
  END IF;

  IF v_amount <= 0 THEN RAISE EXCEPTION 'Plan sin precio definido'; END IF;

  -- Crear/actualizar subscription en estado pending_payment
  INSERT INTO tenant_subscriptions (
    tenant_id, plan_id, status, billing_cycle,
    current_period_start, current_period_end
  )
  VALUES (
    p_tenant_id, p_plan_id, 'pending_payment', p_billing_cycle,
    NOW(), v_period_end
  )
  RETURNING id INTO v_subscription_id;

  RETURN json_build_object(
    'subscription_id', v_subscription_id,
    'amount', v_amount,
    'plan_name', v_plan.name,
    'billing_cycle', p_billing_cycle,
    'period_end', v_period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_request_plan_upgrade(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- 8. RPC: subscription_apply_payment (service_role)
-- Llamada por Wompi webhook cuando el pago de subscription es approved.
-- ============================================
CREATE OR REPLACE FUNCTION public.subscription_apply_payment(
  p_subscription_id UUID,
  p_payment_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_sub RECORD;
  v_extension INTERVAL;
BEGIN
  SELECT * INTO v_sub FROM tenant_subscriptions WHERE id = p_subscription_id;
  IF v_sub.id IS NULL THEN RAISE EXCEPTION 'Subscription no encontrada'; END IF;

  v_extension := CASE v_sub.billing_cycle
    WHEN 'yearly' THEN INTERVAL '1 year'
    ELSE INTERVAL '1 month'
  END;

  -- Si el período ya venció, partir desde ahora; si está vigente, sumar al final
  UPDATE tenant_subscriptions SET
    status = 'active',
    current_period_start = CASE
      WHEN current_period_end > NOW() THEN current_period_start
      ELSE NOW()
    END,
    current_period_end = CASE
      WHEN current_period_end > NOW() THEN current_period_end + v_extension
      ELSE NOW() + v_extension
    END,
    last_payment_id = p_payment_id,
    cancel_at_period_end = FALSE,
    cancelled_at = NULL
  WHERE id = p_subscription_id;

  -- Mirror al tenant.plan / plan_status para queries simples
  UPDATE tenants SET
    plan = v_sub.plan_id,
    plan_status = 'active',
    trial_ends_at = NULL
  WHERE id = v_sub.tenant_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.subscription_apply_payment(UUID, UUID) TO service_role;

-- ============================================
-- 9. RPC: tenant_cancel_subscription — programa cancelación al final del período
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_cancel_subscription(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_sub RECORD;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id
      AND role = 'owner' AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo el owner puede cancelar';
  END IF;

  UPDATE tenant_subscriptions SET
    cancel_at_period_end = TRUE,
    cancelled_at = NOW()
  WHERE tenant_id = p_tenant_id
    AND status IN ('active', 'past_due', 'trial')
  RETURNING * INTO v_sub;

  IF v_sub.id IS NULL THEN
    RAISE EXCEPTION 'No hay suscripción activa';
  END IF;

  RETURN json_build_object(
    'ok', true,
    'cancelled_at', v_sub.cancelled_at,
    'period_end', v_sub.current_period_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_cancel_subscription(UUID) TO authenticated;
