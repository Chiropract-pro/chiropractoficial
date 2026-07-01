-- ============================================
-- 024_team_invitations.sql
-- Sistema de invitaciones de equipo.
--
-- Resuelve la raíz de los "tenants fantasma": hoy CUALQUIER signup nuevo cae en
-- OnboardingPage y crea un consultorio nuevo. Con invitaciones, el usuario correcto
-- (invitado por email) se UNE al consultorio existente en vez de crear uno duplicado.
--
-- Flujo:
--   1. Owner/admin invita un email desde Settings → Equipo → invite_member()
--   2. La persona hace signup/login con ese email
--   3. El router detecta la invitación pendiente (get_my_pending_invitations)
--      y le ofrece UNIRSE en vez de forzar onboarding
--   4. accept_invitation() crea la membership y asigna default_tenant_id
-- ============================================

CREATE TABLE IF NOT EXISTS tenant_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,                       -- normalizado a lowercase
  role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (role IN ('admin', 'doctor', 'assistant', 'receptionist')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email, status)
);

CREATE INDEX IF NOT EXISTS idx_invitations_email_pending
  ON tenant_invitations (lower(email)) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_invitations_tenant
  ON tenant_invitations (tenant_id, status);

ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Owner/admin del tenant pueden ver/gestionar sus invitaciones
DROP POLICY IF EXISTS "owner_admin_manage_invitations" ON tenant_invitations;
CREATE POLICY "owner_admin_manage_invitations" ON tenant_invitations
  FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
    )
  );

-- ============================================
-- RPC: invite_member — crea/reactiva una invitación
-- ============================================
CREATE OR REPLACE FUNCTION public.invite_member(
  p_tenant_id UUID,
  p_email TEXT,
  p_role TEXT DEFAULT 'doctor'
)
RETURNS tenant_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT := lower(trim(p_email));
  v_inv tenant_invitations%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id
      AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo owner o admin pueden invitar';
  END IF;

  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  IF p_role NOT IN ('admin', 'doctor', 'assistant', 'receptionist') THEN
    RAISE EXCEPTION 'Rol inválido';
  END IF;

  -- ¿Ya es miembro? (por el email en profiles/auth)
  IF EXISTS (
    SELECT 1 FROM tenant_memberships m
    JOIN auth.users u ON u.id = m.user_id
    WHERE m.tenant_id = p_tenant_id AND lower(u.email) = v_email
  ) THEN
    RAISE EXCEPTION 'Esa persona ya es miembro del consultorio';
  END IF;

  -- Upsert: si ya había una invitación pending, la refrescamos
  INSERT INTO tenant_invitations (tenant_id, email, role, invited_by, status, expires_at)
  VALUES (p_tenant_id, v_email, p_role, v_user, 'pending', NOW() + INTERVAL '14 days')
  ON CONFLICT (tenant_id, email, status) DO UPDATE
    SET role = EXCLUDED.role, invited_by = EXCLUDED.invited_by,
        expires_at = NOW() + INTERVAL '14 days', created_at = NOW()
  RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.invite_member(UUID, TEXT, TEXT) TO authenticated;

-- ============================================
-- RPC: get_my_pending_invitations — invitaciones para el email del usuario logueado
-- ============================================
CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
  invitation_id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  role TEXT,
  invited_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT i.id, i.tenant_id, t.name, i.role, i.created_at
  FROM tenant_invitations i
  JOIN tenants t ON t.id = i.tenant_id
  WHERE lower(i.email) = v_email
    AND i.status = 'pending'
    AND i.expires_at > NOW()
  ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations() TO authenticated;

-- ============================================
-- RPC: accept_invitation — une al usuario al consultorio
-- ============================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_invitation_id UUID)
RETURNS tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT;
  v_inv tenant_invitations%ROWTYPE;
  v_tenant tenants%ROWTYPE;
  v_has_default BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;

  SELECT * INTO v_inv FROM tenant_invitations WHERE id = p_invitation_id;
  IF v_inv.id IS NULL THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;
  IF v_inv.status <> 'pending' THEN RAISE EXCEPTION 'La invitación ya no está vigente'; END IF;
  IF v_inv.expires_at <= NOW() THEN
    UPDATE tenant_invitations SET status = 'expired' WHERE id = p_invitation_id;
    RAISE EXCEPTION 'La invitación expiró';
  END IF;
  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION 'Esta invitación es para otro correo';
  END IF;

  -- Crear membership (aceptada) si no existe
  INSERT INTO tenant_memberships (user_id, tenant_id, role, accepted_at)
  VALUES (v_user, v_inv.tenant_id, v_inv.role, NOW())
  ON CONFLICT (user_id, tenant_id) DO UPDATE
    SET role = EXCLUDED.role, accepted_at = COALESCE(tenant_memberships.accepted_at, NOW());

  -- Asignar como tenant por defecto si el usuario aún no tiene uno
  SELECT default_tenant_id IS NOT NULL INTO v_has_default FROM profiles WHERE id = v_user;
  IF NOT COALESCE(v_has_default, FALSE) THEN
    UPDATE profiles SET default_tenant_id = v_inv.tenant_id WHERE id = v_user;
  END IF;

  UPDATE tenant_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = p_invitation_id;

  SELECT * INTO v_tenant FROM tenants WHERE id = v_inv.tenant_id;
  RETURN v_tenant;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(UUID) TO authenticated;

-- ============================================
-- RPC: revoke_invitation
-- ============================================
CREATE OR REPLACE FUNCTION public.revoke_invitation(p_invitation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tenant UUID;
BEGIN
  SELECT tenant_id INTO v_tenant FROM tenant_invitations WHERE id = p_invitation_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Invitación no encontrada'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = v_tenant
      AND role IN ('owner', 'admin') AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo owner o admin pueden revocar';
  END IF;

  UPDATE tenant_invitations SET status = 'revoked' WHERE id = p_invitation_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_invitation(UUID) TO authenticated;
