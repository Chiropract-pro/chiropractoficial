-- ============================================
-- 027_profile_bridge_and_fixes.sql
--
-- (1) FIX de seguridad/correctitud: los triggers de contadores de 026 no eran
--     SECURITY DEFINER → bajo RLS, un usuario autenticado no puede UPDATE la fila
--     de otro (followers) ni la tabla posts (sin policy UPDATE), así que los
--     contadores NUNCA incrementaban en producción. Se recrean como DEFINER.
--
-- (2) FIX de seguridad: la policy owner_update_practitioner permitía al dueño
--     editar CUALQUIER columna, incluida `verified`/`featured` → un médico podía
--     auto-verificarse y ganar permiso de publicar. Se elimina; las ediciones van
--     por RPC con columnas en lista blanca (verified/featured quedan solo-admin).
--
-- (3) PUENTE registro → directorio: ensure_my_practitioner_profile() crea el perfil
--     del médico (idempotente) y update_my_practitioner_profile(jsonb) lo edita.
-- ============================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- ---------- (1) Triggers de contadores como SECURITY DEFINER ----------
CREATE OR REPLACE FUNCTION public._bump_likes() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._bump_comments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._bump_posts_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE practitioner_profiles SET posts_count = posts_count + 1 WHERE id = NEW.author_id; RETURN NEW;
  ELSE
    UPDATE practitioner_profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE id = OLD.author_id; RETURN OLD;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public._bump_followers() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE practitioner_profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id; RETURN NEW;
  ELSE
    UPDATE practitioner_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id; RETURN OLD;
  END IF;
END; $$;

-- ---------- (2) Cerrar el hueco de auto-verificación ----------
-- Sin policy de UPDATE directo: toda edición pasa por el RPC de lista blanca.
DROP POLICY IF EXISTS "owner_update_practitioner" ON practitioner_profiles;

-- ---------- (3) Puente registro → perfil de directorio ----------
CREATE OR REPLACE FUNCTION public._slugify(p_text TEXT) RETURNS TEXT
LANGUAGE sql IMMUTABLE SET search_path = public, pg_catalog AS $$
  SELECT btrim(regexp_replace(lower(unaccent(coalesce(p_text, ''))), '[^a-z0-9]+', '-', 'g'), '-');
$$;

-- Crea el perfil del médico logueado si no existe (idempotente). Inicia oculto y sin verificar.
CREATE OR REPLACE FUNCTION public.ensure_my_practitioner_profile()
RETURNS practitioner_profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row practitioner_profiles;
  v_name TEXT;
  v_tenant UUID;
  v_base TEXT;
  v_slug TEXT;
  v_i INT := 1;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT * INTO v_row FROM practitioner_profiles WHERE user_id = v_uid LIMIT 1;
  IF FOUND THEN RETURN v_row; END IF;

  SELECT full_name, default_tenant_id INTO v_name, v_tenant FROM profiles WHERE id = v_uid;
  v_name := coalesce(nullif(btrim(v_name), ''), 'Médico');

  v_base := coalesce(nullif(public._slugify(v_name), ''), 'medico');
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM practitioner_profiles WHERE slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := v_base || '-' || v_i;
  END LOOP;

  INSERT INTO practitioner_profiles (user_id, tenant_id, slug, full_name, is_public, verified)
  VALUES (v_uid, v_tenant, v_slug, v_name, FALSE, FALSE)
  RETURNING * INTO v_row;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.ensure_my_practitioner_profile() TO authenticated;

-- Edita el perfil del médico logueado. Lista blanca de columnas: NUNCA toca verified/featured/slug.
CREATE OR REPLACE FUNCTION public.update_my_practitioner_profile(p JSONB)
RETURNS practitioner_profiles
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_row practitioner_profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  UPDATE practitioner_profiles SET
    title              = coalesce(nullif(btrim(p->>'title'), ''), title),
    full_name          = coalesce(nullif(btrim(p->>'full_name'), ''), full_name),
    headline           = CASE WHEN p ? 'headline' THEN nullif(btrim(p->>'headline'), '') ELSE headline END,
    bio                = CASE WHEN p ? 'bio' THEN nullif(btrim(p->>'bio'), '') ELSE bio END,
    specialties        = CASE WHEN p ? 'specialties'
                              THEN coalesce((SELECT array_agg(btrim(value)) FROM jsonb_array_elements_text(p->'specialties') WHERE btrim(value) <> ''), '{}')
                              ELSE specialties END,
    city               = CASE WHEN p ? 'city' THEN nullif(btrim(p->>'city'), '') ELSE city END,
    country            = coalesce(nullif(btrim(p->>'country'), ''), country),
    photo_url          = CASE WHEN p ? 'photo_url' THEN nullif(btrim(p->>'photo_url'), '') ELSE photo_url END,
    years_experience   = CASE WHEN p ? 'years_experience' THEN nullif(p->>'years_experience', '')::INT ELSE years_experience END,
    whatsapp           = CASE WHEN p ? 'whatsapp' THEN nullif(btrim(p->>'whatsapp'), '') ELSE whatsapp END,
    instagram          = CASE WHEN p ? 'instagram' THEN nullif(btrim(p->>'instagram'), '') ELSE instagram END,
    website            = CASE WHEN p ? 'website' THEN nullif(btrim(p->>'website'), '') ELSE website END,
    accepting_patients = coalesce((p->>'accepting_patients')::BOOLEAN, accepting_patients),
    is_public          = coalesce((p->>'is_public')::BOOLEAN, is_public)
  WHERE user_id = auth.uid()
  RETURNING * INTO v_row;

  IF NOT FOUND THEN RAISE EXCEPTION 'No tienes un perfil de médico'; END IF;
  RETURN v_row;
END; $$;
GRANT EXECUTE ON FUNCTION public.update_my_practitioner_profile(JSONB) TO authenticated;
