-- ============================================
-- 020_billing_dian.sql
-- FASE 3 — Facturación Electrónica DIAN vía Alegra
--
-- DIAN (Colombia) requiere factura electrónica para PJ y PN con ingresos > UVT
-- topes anuales. Alegra es proveedor tecnológico autorizado: gestiona XML,
-- firma digital, CUFE, envío a DIAN, y devuelve PDF + XML.
--
-- Flow:
--   1. Doctor configura Alegra credentials en Settings (1 vez)
--   2. Cobra una venta normal en CRM → guarda en `sales`
--   3. Click "Emitir factura electrónica" → Edge Function alegra-emit-invoice
--   4. Edge Function crea contact + invoice en Alegra → recibe CUFE + PDF
--   5. Sale queda con e_invoice_status='accepted', CUFE, PDF URL
--
-- DIAN requiere ID del paciente (CC/NIT/CE/...). Si falta, la emisión bloquea
-- y pide completar el dato.
-- ============================================

-- ============================================
-- 1. tenant_billing_config — credenciales Alegra por consultorio
-- ============================================
CREATE TABLE IF NOT EXISTS tenant_billing_config (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'alegra'
    CHECK (provider IN ('alegra', 'siigo', 'manual')),

  -- Alegra credentials (Basic Auth: email:token base64)
  api_email TEXT,
  api_token TEXT,  -- TODO: pgsodium encryption (Supabase Vault) — MVP: plain bajo RLS

  -- Configuración DIAN
  resolution_id TEXT,  -- ID de la numeración DIAN (Alegra lo expone como "numerations")
  test_mode BOOLEAN NOT NULL DEFAULT TRUE,

  -- Datos de la empresa (emisor) — usados en cada factura
  business_name TEXT,
  business_id TEXT,
  business_id_type TEXT NOT NULL DEFAULT 'NIT'
    CHECK (business_id_type IN ('NIT', 'CC', 'CE', 'TI', 'RC', 'PA', 'PEP')),
  business_address TEXT,
  business_city TEXT,

  -- Estado del último test de conexión
  last_test_at TIMESTAMPTZ,
  last_test_ok BOOLEAN,
  last_test_error TEXT,

  is_active BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS billing_config_updated_at ON tenant_billing_config;
CREATE TRIGGER billing_config_updated_at
  BEFORE UPDATE ON tenant_billing_config
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE tenant_billing_config ENABLE ROW LEVEL SECURITY;

-- Solo owner/admin del tenant pueden leer/escribir credenciales
DROP POLICY IF EXISTS "billing_config_owner_admin" ON tenant_billing_config;
CREATE POLICY "billing_config_owner_admin"
  ON tenant_billing_config
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND accepted_at IS NOT NULL
    )
  );

-- ============================================
-- 2. ALTER patients — DIAN requiere id_type + id_number
-- ============================================
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS id_type TEXT
    CHECK (id_type IS NULL OR id_type IN ('CC', 'CE', 'TI', 'RC', 'NIT', 'PA', 'PEP')),
  ADD COLUMN IF NOT EXISTS id_number TEXT;

CREATE INDEX IF NOT EXISTS idx_patients_id_number
  ON patients(tenant_id, id_number) WHERE id_number IS NOT NULL;

-- ============================================
-- 3. ALTER sales — campos para factura electrónica
-- ============================================
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS e_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_number TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_cufe TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_status TEXT NOT NULL DEFAULT 'none'
    CHECK (e_invoice_status IN ('none', 'pending', 'sent', 'accepted', 'rejected', 'cancelled', 'error')),
  ADD COLUMN IF NOT EXISTS e_invoice_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_xml_url TEXT,
  ADD COLUMN IF NOT EXISTS e_invoice_emitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS e_invoice_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS e_invoice_error TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_e_invoice_status
  ON sales(tenant_id, e_invoice_status) WHERE e_invoice_status NOT IN ('none', 'accepted');

-- ============================================
-- 4. RPC: tenant_billing_config_upsert
-- Usado por Settings UI para guardar credenciales (con validación de role)
-- ============================================
CREATE OR REPLACE FUNCTION public.tenant_billing_config_upsert(
  p_tenant_id UUID,
  p_provider TEXT DEFAULT 'alegra',
  p_api_email TEXT DEFAULT NULL,
  p_api_token TEXT DEFAULT NULL,
  p_resolution_id TEXT DEFAULT NULL,
  p_test_mode BOOLEAN DEFAULT TRUE,
  p_business_name TEXT DEFAULT NULL,
  p_business_id TEXT DEFAULT NULL,
  p_business_id_type TEXT DEFAULT 'NIT',
  p_business_address TEXT DEFAULT NULL,
  p_business_city TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT FALSE
)
RETURNS tenant_billing_config
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_config tenant_billing_config%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id
      AND role IN ('owner', 'admin')
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo owner o admin pueden configurar facturación';
  END IF;

  INSERT INTO tenant_billing_config (
    tenant_id, provider, api_email, api_token, resolution_id, test_mode,
    business_name, business_id, business_id_type, business_address, business_city,
    is_active
  )
  VALUES (
    p_tenant_id, p_provider, p_api_email, p_api_token, p_resolution_id, p_test_mode,
    p_business_name, p_business_id, p_business_id_type, p_business_address, p_business_city,
    p_is_active
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    provider = EXCLUDED.provider,
    api_email = COALESCE(EXCLUDED.api_email, tenant_billing_config.api_email),
    api_token = COALESCE(EXCLUDED.api_token, tenant_billing_config.api_token),
    resolution_id = EXCLUDED.resolution_id,
    test_mode = EXCLUDED.test_mode,
    business_name = EXCLUDED.business_name,
    business_id = EXCLUDED.business_id,
    business_id_type = EXCLUDED.business_id_type,
    business_address = EXCLUDED.business_address,
    business_city = EXCLUDED.business_city,
    is_active = EXCLUDED.is_active
  RETURNING * INTO v_config;

  RETURN v_config;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tenant_billing_config_upsert(
  UUID, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN
) TO authenticated;

-- ============================================
-- 5. RPC: get_billing_config_for_emit (service_role only)
-- Usado por Edge Function alegra-emit-invoice para cargar credenciales
-- y todos los datos necesarios para emitir.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_billing_config_for_emit(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT row_to_json(c) INTO v_result
  FROM tenant_billing_config c
  WHERE c.tenant_id = p_tenant_id AND c.is_active = TRUE;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_billing_config_for_emit(UUID) TO service_role;

-- ============================================
-- 6. RPC: get_sale_for_emit (service_role) — bundle completo
-- ============================================
CREATE OR REPLACE FUNCTION public.get_sale_for_emit(p_sale_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'sale', row_to_json(s),
    'patient', row_to_json(p),
    'items', (
      SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.created_at), '[]'::json)
      FROM sale_items i WHERE i.sale_id = s.id
    ),
    'tenant', row_to_json(t)
  )
  INTO v_result
  FROM sales s
  LEFT JOIN patients p ON p.id = s.patient_id
  LEFT JOIN tenants t ON t.id = s.tenant_id
  WHERE s.id = p_sale_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_sale_for_emit(UUID) TO service_role;
