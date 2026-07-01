-- ============================================
-- 006_create_tenant_rpc.sql
-- SEC-021: createTenant transaccional vía RPC
-- En lugar de 3 operaciones independientes desde el cliente,
-- una sola función que falla atómicamente.
-- ============================================

CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_city TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT 'trial'
)
RETURNS tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id UUID;
  v_user_email TEXT;
  v_owner_name TEXT;
  v_tenant tenants%ROWTYPE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING ERRCODE = '28000';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION 'Nombre del consultorio inválido';
  END IF;

  IF p_slug IS NULL OR length(p_slug) < 3 OR p_slug !~ '^[a-z0-9][a-z0-9-]*$' THEN
    RAISE EXCEPTION 'Slug inválido (mínimo 3 caracteres, solo letras, números y guiones)';
  END IF;

  IF p_plan NOT IN ('trial', 'basic', 'pro', 'enterprise') THEN
    RAISE EXCEPTION 'Plan inválido';
  END IF;

  -- Email y nombre del usuario
  SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;
  SELECT COALESCE(full_name, v_user_email) INTO v_owner_name
  FROM profiles WHERE id = v_user_id;

  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado';
  END IF;

  -- Insertar tenant
  INSERT INTO tenants (name, slug, owner_email, owner_name, city, phone, plan)
  VALUES (
    trim(p_name),
    lower(p_slug),
    v_user_email,
    v_owner_name,
    NULLIF(trim(COALESCE(p_city, '')), ''),
    NULLIF(trim(COALESCE(p_phone, '')), ''),
    p_plan
  )
  RETURNING * INTO v_tenant;

  -- Crear membresía como owner
  INSERT INTO tenant_memberships (user_id, tenant_id, role, accepted_at)
  VALUES (v_user_id, v_tenant.id, 'owner', NOW());

  -- Asignar default_tenant_id
  UPDATE profiles SET default_tenant_id = v_tenant.id WHERE id = v_user_id;

  RETURN v_tenant;

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Esa URL ya está en uso. Elige otra.' USING ERRCODE = '23505';
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
