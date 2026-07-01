-- ============================================
-- Chiropract.co SaaS Multi-Tenant Schema
-- Created by: Dr. Miguel Ángel Díaz & Invent Agency
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TENANTS (Clinics / Chiropractic Practices)
-- ============================================
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT DEFAULT 'Colombia',
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'basic', 'pro', 'enterprise')),
  plan_status TEXT NOT NULL DEFAULT 'active' CHECK (plan_status IN ('active', 'past_due', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  max_patients INT DEFAULT 50,
  max_users INT DEFAULT 2,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. TENANT MEMBERSHIPS (Users belonging to tenants)
-- ============================================
CREATE TABLE tenant_memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor' CHECK (role IN ('owner', 'admin', 'doctor', 'assistant', 'receptionist')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, tenant_id)
);

-- ============================================
-- 3. PROFILES (User profile data)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  default_tenant_id UUID REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PATIENTS
-- ============================================
CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'inactivo', 'en_tratamiento', 'completado')),
  treatment TEXT,
  notes TEXT,
  vip BOOLEAN DEFAULT FALSE,
  total_spent BIGINT DEFAULT 0,
  appointments_count INT DEFAULT 0,
  last_visit DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. APPOINTMENTS
-- ============================================
CREATE TABLE appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE NOT NULL,
  patient_name TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type TEXT NOT NULL DEFAULT 'primera_consulta' CHECK (type IN ('primera_consulta', 'seguimiento', 'jornada', 'emergencia')),
  location TEXT NOT NULL DEFAULT 'consultorio',
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'confirmada', 'cancelada', 'completada', 'no_asistio')),
  price BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. JORNADAS (Itinerant clinic days)
-- ============================================
CREATE TABLE jornadas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  city TEXT NOT NULL,
  date DATE NOT NULL,
  capacity INT NOT NULL DEFAULT 15,
  booked INT NOT NULL DEFAULT 0,
  price_per_patient BIGINT NOT NULL DEFAULT 150000,
  status TEXT NOT NULL DEFAULT 'programada' CHECK (status IN ('programada', 'completada', 'cancelada')),
  notes TEXT,
  revenue BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. LEADS (Marketing)
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('whatsapp', 'instagram', 'facebook', 'web', 'referido', 'jornada')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'contactado', 'convertido', 'perdido')),
  converted_to_patient BOOLEAN DEFAULT FALSE,
  patient_id UUID REFERENCES patients(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. TRANSACTIONS (Finance)
-- ============================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  patient_id UUID REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  type TEXT NOT NULL DEFAULT 'income' CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL DEFAULT 'consultorio' CHECK (category IN ('consultorio', 'jornada', 'marketing', 'operational', 'other')),
  amount BIGINT NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ALERTS
-- ============================================
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'warning', 'danger', 'success')),
  message TEXT NOT NULL,
  action TEXT,
  reference_id UUID,
  dismissed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. SCHEDULED CONTENT (Marketing)
-- ============================================
CREATE TABLE scheduled_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'whatsapp', 'email')),
  date DATE NOT NULL,
  content_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'programado', 'publicado')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_content ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's tenant_id
CREATE OR REPLACE FUNCTION public.get_user_tenant_id() RETURNS UUID AS $$
  SELECT default_tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Helper function: check if user is member of tenant
CREATE OR REPLACE FUNCTION public.is_tenant_member(tid UUID) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = tid
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Tenants: users can only see their own tenants
CREATE POLICY "Users can view own tenants" ON tenants
  FOR SELECT USING (public.is_tenant_member(id));
CREATE POLICY "Owners can update own tenants" ON tenants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tenant_memberships WHERE role = 'owner' AND user_id = auth.uid() AND tenant_id = tenants.id)
  );

-- Tenant memberships
CREATE POLICY "Users can view own memberships" ON tenant_memberships
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can view memberships of their tenant" ON tenant_memberships
  FOR SELECT USING (public.is_tenant_member(tenant_id));

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Patients: tenant-scoped
CREATE POLICY "Tenant members can view patients" ON patients
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert patients" ON patients
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update patients" ON patients
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete patients" ON patients
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Appointments: tenant-scoped
CREATE POLICY "Tenant members can view appointments" ON appointments
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert appointments" ON appointments
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update appointments" ON appointments
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete appointments" ON appointments
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Jornadas: tenant-scoped
CREATE POLICY "Tenant members can view jornadas" ON jornadas
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert jornadas" ON jornadas
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update jornadas" ON jornadas
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete jornadas" ON jornadas
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Leads: tenant-scoped
CREATE POLICY "Tenant members can view leads" ON leads
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert leads" ON leads
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update leads" ON leads
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete leads" ON leads
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Transactions: tenant-scoped
CREATE POLICY "Tenant members can view transactions" ON transactions
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert transactions" ON transactions
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update transactions" ON transactions
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete transactions" ON transactions
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Alerts: tenant-scoped
CREATE POLICY "Tenant members can view alerts" ON alerts
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert alerts" ON alerts
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update alerts" ON alerts
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete alerts" ON alerts
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- Scheduled content: tenant-scoped
CREATE POLICY "Tenant members can view scheduled_content" ON scheduled_content
  FOR SELECT USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can insert scheduled_content" ON scheduled_content
  FOR INSERT WITH CHECK (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can update scheduled_content" ON scheduled_content
  FOR UPDATE USING (public.is_tenant_member(tenant_id));
CREATE POLICY "Tenant members can delete scheduled_content" ON scheduled_content
  FOR DELETE USING (public.is_tenant_member(tenant_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
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
CREATE OR REPLACE FUNCTION handle_new_user()
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
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_patients_tenant ON patients(tenant_id);
CREATE INDEX idx_appointments_tenant_date ON appointments(tenant_id, date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_jornadas_tenant_date ON jornadas(tenant_id, date);
CREATE INDEX idx_leads_tenant ON leads(tenant_id);
CREATE INDEX idx_transactions_tenant_date ON transactions(tenant_id, date);
CREATE INDEX idx_alerts_tenant ON alerts(tenant_id);
CREATE INDEX idx_tenant_memberships_user ON tenant_memberships(user_id);
CREATE INDEX idx_tenant_memberships_tenant ON tenant_memberships(tenant_id);
