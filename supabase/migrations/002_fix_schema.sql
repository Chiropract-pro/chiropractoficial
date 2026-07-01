-- Fix: Drop partially created objects and recreate cleanly
-- Drop existing policies if they exist (they may have been partially created)
DROP POLICY IF EXISTS "Users can view own tenants" ON tenants;
DROP POLICY IF EXISTS "Owners can update own tenants" ON tenants;
DROP POLICY IF EXISTS "Users can view own memberships" ON tenant_memberships;
DROP POLICY IF EXISTS "Users can view memberships of their tenant" ON tenant_memberships;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Tenant members can view patients" ON patients;
DROP POLICY IF EXISTS "Tenant members can insert patients" ON patients;
DROP POLICY IF EXISTS "Tenant members can update patients" ON patients;
DROP POLICY IF EXISTS "Tenant members can delete patients" ON patients;
DROP POLICY IF EXISTS "Tenant members can view appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant members can insert appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant members can update appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant members can delete appointments" ON appointments;
DROP POLICY IF EXISTS "Tenant members can view jornadas" ON jornadas;
DROP POLICY IF EXISTS "Tenant members can insert jornadas" ON jornadas;
DROP POLICY IF EXISTS "Tenant members can update jornadas" ON jornadas;
DROP POLICY IF EXISTS "Tenant members can delete jornadas" ON jornadas;
DROP POLICY IF EXISTS "Tenant members can view leads" ON leads;
DROP POLICY IF EXISTS "Tenant members can insert leads" ON leads;
DROP POLICY IF EXISTS "Tenant members can update leads" ON leads;
DROP POLICY IF EXISTS "Tenant members can delete leads" ON leads;
DROP POLICY IF EXISTS "Tenant members can view transactions" ON transactions;
DROP POLICY IF EXISTS "Tenant members can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Tenant members can update transactions" ON transactions;
DROP POLICY IF EXISTS "Tenant members can delete transactions" ON transactions;
DROP POLICY IF EXISTS "Tenant members can view alerts" ON alerts;
DROP POLICY IF EXISTS "Tenant members can insert alerts" ON alerts;
DROP POLICY IF EXISTS "Tenant members can update alerts" ON alerts;
DROP POLICY IF EXISTS "Tenant members can delete alerts" ON alerts;
DROP POLICY IF EXISTS "Tenant members can view scheduled_content" ON scheduled_content;
DROP POLICY IF EXISTS "Tenant members can insert scheduled_content" ON scheduled_content;
DROP POLICY IF EXISTS "Tenant members can update scheduled_content" ON scheduled_content;
DROP POLICY IF EXISTS "Tenant members can delete scheduled_content" ON scheduled_content;

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.get_user_tenant_id();
DROP FUNCTION IF EXISTS public.is_tenant_member(UUID);
DROP FUNCTION IF EXISTS update_updated_at();
DROP FUNCTION IF EXISTS handle_new_user();
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_patients_updated_at ON patients;
DROP TRIGGER IF EXISTS update_appointments_updated_at ON appointments;
DROP TRIGGER IF EXISTS update_jornadas_updated_at ON jornadas;
DROP TRIGGER IF EXISTS update_leads_updated_at ON leads;

-- Helper functions (public schema)
CREATE OR REPLACE FUNCTION public.is_tenant_member(tid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = tid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- RLS Policies
CREATE POLICY "Users can view own tenants" ON tenants
  FOR SELECT USING (public.is_tenant_member(id));
CREATE POLICY "Owners can update own tenants" ON tenants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tenant_memberships WHERE role = 'owner' AND user_id = auth.uid() AND tenant_id = tenants.id)
  );

CREATE POLICY "Users can view own memberships" ON tenant_memberships
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view memberships of their tenant" ON tenant_memberships
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Owners can insert memberships" ON tenant_memberships
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tenant_memberships WHERE role IN ('owner', 'admin') AND user_id = auth.uid() AND tenant_id = tenant_memberships.tenant_id)
  );

CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Tenant members can view patients" ON patients
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert patients" ON patients
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update patients" ON patients
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete patients" ON patients
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view appointments" ON appointments
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert appointments" ON appointments
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update appointments" ON appointments
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete appointments" ON appointments
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view jornadas" ON jornadas
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert jornadas" ON jornadas
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update jornadas" ON jornadas
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete jornadas" ON jornadas
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view leads" ON leads
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert leads" ON leads
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update leads" ON leads
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete leads" ON leads
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view transactions" ON transactions
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert transactions" ON transactions
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update transactions" ON transactions
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete transactions" ON transactions
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view alerts" ON alerts
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert alerts" ON alerts
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update alerts" ON alerts
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete alerts" ON alerts
  FOR DELETE USING (public.is_tenant_member(tenant_id));

CREATE POLICY "Tenant members can view scheduled_content" ON scheduled_content
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert scheduled_content" ON scheduled_content
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update scheduled_content" ON scheduled_content
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete scheduled_content" ON scheduled_content
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_jornadas_updated_at BEFORE UPDATE ON jornadas FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date ON appointments(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_tenant_date ON jornadas(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_date ON transactions(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
