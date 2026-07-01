-- ============================================
-- 005_security_hardening.sql
-- Hardening: search_path en SECURITY DEFINER, stock RAISE,
-- policies faltantes, sale_items.tenant_id, trigger consistencia.
-- ============================================

-- ============================================
-- SEC-002: search_path fijo en SECURITY DEFINER
-- ============================================
CREATE OR REPLACE FUNCTION public.is_tenant_member(tid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = tid
  );
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- SEC-014: stock insuficiente debe FALLAR (no oversell silencioso)
-- ============================================
CREATE OR REPLACE FUNCTION public.decrement_product_stock(p_id UUID, qty INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  current_stock INT;
  new_stock INT;
  product_tenant UUID;
BEGIN
  IF qty <= 0 THEN
    RAISE EXCEPTION 'La cantidad debe ser mayor a 0';
  END IF;

  SELECT tenant_id, stock INTO product_tenant, current_stock
  FROM products
  WHERE id = p_id
  FOR UPDATE;

  IF product_tenant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT public.is_tenant_member(product_tenant) THEN
    RAISE EXCEPTION 'No tienes permiso sobre este producto';
  END IF;

  IF current_stock < qty THEN
    RAISE EXCEPTION 'Stock insuficiente: hay % unidades, se requieren %', current_stock, qty;
  END IF;

  UPDATE products
  SET stock = stock - qty,
      updated_at = NOW()
  WHERE id = p_id
  RETURNING stock INTO new_stock;

  RETURN new_stock;
END;
$$;

-- ============================================
-- SEC-003: sale_items necesita tenant_id propio + consistencia con sale
-- ============================================
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill desde sales (idempotente)
UPDATE sale_items si
SET tenant_id = s.tenant_id
FROM sales s
WHERE si.sale_id = s.id AND si.tenant_id IS NULL;

ALTER TABLE sale_items ALTER COLUMN tenant_id SET NOT NULL;

-- Trigger que copia tenant_id desde sales al insertar y valida consistencia con services/products
CREATE OR REPLACE FUNCTION public.sale_item_tenant_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  sale_tenant UUID;
  ref_tenant UUID;
BEGIN
  SELECT tenant_id INTO sale_tenant FROM sales WHERE id = NEW.sale_id;
  IF sale_tenant IS NULL THEN
    RAISE EXCEPTION 'Sale no encontrado';
  END IF;
  NEW.tenant_id := sale_tenant;

  IF NEW.item_type = 'service' THEN
    SELECT tenant_id INTO ref_tenant FROM services WHERE id = NEW.service_id;
  ELSIF NEW.item_type = 'product' THEN
    SELECT tenant_id INTO ref_tenant FROM products WHERE id = NEW.product_id;
  END IF;

  IF ref_tenant IS NULL THEN
    RAISE EXCEPTION 'Item referenciado no existe';
  END IF;

  IF ref_tenant <> sale_tenant THEN
    RAISE EXCEPTION 'Inconsistencia de tenant entre sale e item';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_tenant_check ON sale_items;
CREATE TRIGGER sale_items_tenant_check
  BEFORE INSERT OR UPDATE ON sale_items
  FOR EACH ROW EXECUTE FUNCTION public.sale_item_tenant_check();

-- Reemplazar policies de sale_items por chequeo directo del tenant_id (más simple y rápido)
DROP POLICY IF EXISTS "Tenant members can view sale_items" ON sale_items;
DROP POLICY IF EXISTS "Tenant members can insert sale_items" ON sale_items;
DROP POLICY IF EXISTS "Tenant members can update sale_items" ON sale_items;
DROP POLICY IF EXISTS "Tenant members can delete sale_items" ON sale_items;

CREATE POLICY "Tenant members can view sale_items" ON sale_items
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert sale_items" ON sale_items
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update sale_items" ON sale_items
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete sale_items" ON sale_items
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE INDEX IF NOT EXISTS idx_sale_items_tenant ON sale_items(tenant_id);

-- ============================================
-- SEC-006: policies faltantes en tenants y tenant_memberships
-- ============================================

-- INSERT en tenants: cualquier usuario autenticado puede crear su consultorio
DROP POLICY IF EXISTS "Authenticated users can create tenants" ON tenants;
CREATE POLICY "Authenticated users can create tenants" ON tenants
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE en tenants: solo owner
DROP POLICY IF EXISTS "Owners can delete own tenants" ON tenants;
CREATE POLICY "Owners can delete own tenants" ON tenants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tenant_memberships
            WHERE role = 'owner' AND user_id = auth.uid() AND tenant_id = tenants.id)
  );

-- UPDATE en tenant_memberships: owner/admin pueden cambiar roles
DROP POLICY IF EXISTS "Owners and admins can update memberships" ON tenant_memberships;
CREATE POLICY "Owners and admins can update memberships" ON tenant_memberships
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tenant_memberships m
            WHERE m.role IN ('owner', 'admin')
              AND m.user_id = auth.uid()
              AND m.tenant_id = tenant_memberships.tenant_id)
  );

-- DELETE en tenant_memberships: owner/admin pueden expulsar; usuario puede eliminar su propia membresía
DROP POLICY IF EXISTS "Admins can remove memberships" ON tenant_memberships;
CREATE POLICY "Admins can remove memberships" ON tenant_memberships
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tenant_memberships m
            WHERE m.role IN ('owner', 'admin')
              AND m.user_id = auth.uid()
              AND m.tenant_id = tenant_memberships.tenant_id)
    OR user_id = auth.uid()
  );

-- ============================================
-- SEC-015: trigger que valida default_tenant_id pertenece al usuario
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_default_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.default_tenant_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM tenant_memberships
      WHERE user_id = NEW.id AND tenant_id = NEW.default_tenant_id
    ) THEN
      RAISE EXCEPTION 'No puedes asignar como default un tenant del que no eres miembro';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_profile_default_tenant ON profiles;
CREATE TRIGGER validate_profile_default_tenant
  BEFORE UPDATE OF default_tenant_id ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_default_tenant();
