-- ============================================
-- 011_fix_resolve_inbound.sql
-- Tabla nueva: mapea evolution_instance_id → tenant_id (multi-tenant ready).
-- Función resolve_inbound_phone actualizada para responder a desconocidos.
-- ============================================

-- Tabla que mapea cada instancia de Evolution a un tenant
CREATE TABLE IF NOT EXISTS tenant_whatsapp_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evolution_instance_id TEXT NOT NULL UNIQUE,
  evolution_instance_name TEXT,
  phone_number TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tenant_whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can view instances" ON tenant_whatsapp_instances
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can manage instances" ON tenant_whatsapp_instances
  FOR ALL USING (public.is_tenant_member(tenant_id));

-- Sembrar la del Dr. Díaz
INSERT INTO tenant_whatsapp_instances (tenant_id, evolution_instance_id, evolution_instance_name, phone_number)
SELECT id, 'e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d', 'Miguel Angel Diaz Quiropractico', '573176305076'
FROM tenants WHERE slug = 'quiropraxia-diaz'
ON CONFLICT (evolution_instance_id) DO NOTHING;

-- Función mejorada: si no hay paciente, intenta resolver tenant por instance_id
CREATE OR REPLACE FUNCTION public.resolve_inbound_phone(
  p_phone TEXT,
  p_evolution_instance_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  tenant_id UUID,
  patient_id UUID,
  patient_name TEXT,
  conversation_id UUID,
  is_new_lead BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
  v_tenant UUID;
  v_patient patients%ROWTYPE;
  v_conv UUID;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_normalized) > 10 AND v_normalized LIKE '57%' THEN
    v_normalized := substring(v_normalized FROM 3);
  END IF;

  -- 1. Intentar match a paciente existente
  SELECT * INTO v_patient
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
     OR v_normalized LIKE '%' || regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')
  ORDER BY length(p.phone) DESC
  LIMIT 1;

  IF v_patient.id IS NOT NULL THEN
    -- Paciente conocido
    v_conv := public.upsert_whatsapp_conversation(v_patient.tenant_id, v_normalized, v_patient.id, p_evolution_instance_id);
    RETURN QUERY SELECT v_patient.tenant_id, v_patient.id, v_patient.full_name, v_conv, FALSE;
    RETURN;
  END IF;

  -- 2. No hay paciente — resolver tenant por instance_id
  IF p_evolution_instance_id IS NOT NULL THEN
    SELECT t.tenant_id INTO v_tenant
    FROM tenant_whatsapp_instances t
    WHERE t.evolution_instance_id = p_evolution_instance_id AND t.active = TRUE
    LIMIT 1;
  END IF;

  -- 3. Fallback: primer tenant existente (para single-tenant setup)
  IF v_tenant IS NULL THEN
    SELECT id INTO v_tenant FROM tenants ORDER BY created_at LIMIT 1;
  END IF;

  IF v_tenant IS NULL THEN
    RETURN; -- no hay tenants, no podemos hacer nada
  END IF;

  -- Crear conversación para lead desconocido
  v_conv := public.upsert_whatsapp_conversation(v_tenant, v_normalized, NULL, p_evolution_instance_id);

  RETURN QUERY SELECT v_tenant, NULL::UUID, 'Hola'::TEXT, v_conv, TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_inbound_phone(TEXT, TEXT) TO service_role, authenticated;
