-- ============================================
-- Productos y Servicios — Catálogo + Ventas por Jornada
-- ============================================

-- ============================================
-- 1. SERVICES (Catálogo de servicios)
-- ============================================
CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'consulta' CHECK (category IN ('consulta', 'tratamiento', 'paquete', 'evaluacion', 'otro')),
  price BIGINT NOT NULL DEFAULT 0,
  duration_min INT DEFAULT 30,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PRODUCTS (Catálogo de productos físicos)
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general' CHECK (category IN ('almohada', 'cinturon', 'suplemento', 'accesorio', 'general')),
  sku TEXT,
  price BIGINT NOT NULL DEFAULT 0,
  cost BIGINT DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  active BOOLEAN DEFAULT TRUE,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. JORNADA OFFERINGS (qué se ofrece en cada jornada)
-- ============================================
CREATE TABLE jornada_offerings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product')),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  price_override BIGINT,
  available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT offering_item_consistency CHECK (
    (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR
    (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
  )
);

-- ============================================
-- 4. SALES (Ventas)
-- ============================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  jornada_id UUID REFERENCES jornadas(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total BIGINT NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'transferencia', 'tarjeta', 'nequi', 'daviplata', 'otro')),
  status TEXT NOT NULL DEFAULT 'completada' CHECK (status IN ('pendiente', 'completada', 'cancelada', 'reembolsada')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. SALE ITEMS (Líneas de la venta)
-- ============================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('service', 'product')),
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price BIGINT NOT NULL,
  subtotal BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sale_item_consistency CHECK (
    (item_type = 'service' AND service_id IS NOT NULL AND product_id IS NULL) OR
    (item_type = 'product' AND product_id IS NOT NULL AND service_id IS NULL)
  )
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornada_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Services
CREATE POLICY "Tenant members can view services" ON services
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert services" ON services
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update services" ON services
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete services" ON services
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Products
CREATE POLICY "Tenant members can view products" ON products
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert products" ON products
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update products" ON products
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete products" ON products
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Jornada offerings
CREATE POLICY "Tenant members can view jornada_offerings" ON jornada_offerings
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert jornada_offerings" ON jornada_offerings
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update jornada_offerings" ON jornada_offerings
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete jornada_offerings" ON jornada_offerings
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Sales
CREATE POLICY "Tenant members can view sales" ON sales
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert sales" ON sales
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update sales" ON sales
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete sales" ON sales
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Sale items (heredan tenant del sale via FK)
CREATE POLICY "Tenant members can view sale_items" ON sale_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND public.is_tenant_member(sales.tenant_id))
  );
CREATE POLICY "Tenant members can insert sale_items" ON sale_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND public.is_tenant_member(sales.tenant_id))
  );
CREATE POLICY "Tenant members can update sale_items" ON sale_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND public.is_tenant_member(sales.tenant_id))
  );
CREATE POLICY "Tenant members can delete sale_items" ON sale_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM sales WHERE sales.id = sale_items.sale_id AND public.is_tenant_member(sales.tenant_id))
  );

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_services_tenant ON services(tenant_id) WHERE active = TRUE;
CREATE INDEX idx_products_tenant ON products(tenant_id) WHERE active = TRUE;
CREATE INDEX idx_products_low_stock ON products(tenant_id, stock) WHERE active = TRUE AND stock <= low_stock_threshold;
CREATE INDEX idx_offerings_jornada ON jornada_offerings(jornada_id);
CREATE INDEX idx_offerings_tenant ON jornada_offerings(tenant_id);
CREATE INDEX idx_sales_tenant_date ON sales(tenant_id, date);
CREATE INDEX idx_sales_jornada ON sales(jornada_id);
CREATE INDEX idx_sales_patient ON sales(patient_id);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
