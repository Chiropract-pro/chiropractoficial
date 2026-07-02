-- ============================================
-- 026_social_network.sql
-- Red social profesional de chiropract.co — "el Instagram de los quiroprácticos".
--
-- Solo médicos VERIFICADOS pueden publicar, comentar, dar like y seguir.
-- Cualquiera puede LEER el feed (los perfiles ya son públicos).
--
-- Autor de todo el contenido social = practitioner_profiles.id (no auth.users),
-- para que el feed muestre nombre/foto/slug sin joins a auth.
-- ============================================

-- Helper: el practitioner_profile del usuario autenticado (o NULL)
CREATE OR REPLACE FUNCTION public.my_practitioner_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT id FROM practitioner_profiles WHERE user_id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.my_practitioner_id() TO authenticated;

-- ============================================
-- Tablas
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES practitioner_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INT NOT NULL DEFAULT 0,
  comments_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts (author_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES practitioner_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, practitioner_id)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES practitioner_profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments (post_id, created_at);

CREATE TABLE IF NOT EXISTS follows (
  follower_id UUID NOT NULL REFERENCES practitioner_profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES practitioner_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows (following_id);

-- ============================================
-- Contadores desnormalizados vía triggers
-- ============================================
CREATE OR REPLACE FUNCTION public._bump_likes() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_bump_likes ON post_likes;
CREATE TRIGGER trg_bump_likes AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION public._bump_likes();

CREATE OR REPLACE FUNCTION public._bump_comments() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id; RETURN NEW;
  ELSE
    UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = OLD.post_id; RETURN OLD;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_bump_comments ON post_comments;
CREATE TRIGGER trg_bump_comments AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION public._bump_comments();

CREATE OR REPLACE FUNCTION public._bump_posts_count() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE practitioner_profiles SET posts_count = posts_count + 1 WHERE id = NEW.author_id; RETURN NEW;
  ELSE
    UPDATE practitioner_profiles SET posts_count = GREATEST(0, posts_count - 1) WHERE id = OLD.author_id; RETURN OLD;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_bump_posts_count ON posts;
CREATE TRIGGER trg_bump_posts_count AFTER INSERT OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION public._bump_posts_count();

CREATE OR REPLACE FUNCTION public._bump_followers() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_catalog AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE practitioner_profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id; RETURN NEW;
  ELSE
    UPDATE practitioner_profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id; RETURN OLD;
  END IF;
END; $$;
DROP TRIGGER IF EXISTS trg_bump_followers ON follows;
CREATE TRIGGER trg_bump_followers AFTER INSERT OR DELETE ON follows
  FOR EACH ROW EXECUTE FUNCTION public._bump_followers();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

-- Lectura pública del contenido social
DROP POLICY IF EXISTS "read_posts" ON posts;
CREATE POLICY "read_posts" ON posts FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "read_likes" ON post_likes;
CREATE POLICY "read_likes" ON post_likes FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "read_comments" ON post_comments;
CREATE POLICY "read_comments" ON post_comments FOR SELECT TO anon, authenticated USING (TRUE);
DROP POLICY IF EXISTS "read_follows" ON follows;
CREATE POLICY "read_follows" ON follows FOR SELECT TO anon, authenticated USING (TRUE);

-- Escritura: solo el dueño de un practitioner VERIFICADO
DROP POLICY IF EXISTS "write_posts" ON posts;
CREATE POLICY "write_posts" ON posts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = author_id AND p.user_id = auth.uid() AND p.verified));
DROP POLICY IF EXISTS "delete_own_posts" ON posts;
CREATE POLICY "delete_own_posts" ON posts FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "write_likes" ON post_likes;
CREATE POLICY "write_likes" ON post_likes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = practitioner_id AND p.user_id = auth.uid() AND p.verified));
DROP POLICY IF EXISTS "delete_own_likes" ON post_likes;
CREATE POLICY "delete_own_likes" ON post_likes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = practitioner_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "write_comments" ON post_comments;
CREATE POLICY "write_comments" ON post_comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = author_id AND p.user_id = auth.uid() AND p.verified));
DROP POLICY IF EXISTS "delete_own_comments" ON post_comments;
CREATE POLICY "delete_own_comments" ON post_comments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = author_id AND p.user_id = auth.uid()));

DROP POLICY IF EXISTS "write_follows" ON follows;
CREATE POLICY "write_follows" ON follows FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = follower_id AND p.user_id = auth.uid() AND p.verified));
DROP POLICY IF EXISTS "delete_own_follows" ON follows;
CREATE POLICY "delete_own_follows" ON follows FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM practitioner_profiles p WHERE p.id = follower_id AND p.user_id = auth.uid()));

-- ============================================
-- RPCs
-- ============================================

-- Feed global (o de un autor si p_author_id) con info del autor + si yo di like
CREATE OR REPLACE FUNCTION public.get_feed(
  p_limit INT DEFAULT 20,
  p_before TIMESTAMPTZ DEFAULT NULL,
  p_author_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID, content TEXT, image_url TEXT, likes_count INT, comments_count INT, created_at TIMESTAMPTZ,
  author_id UUID, author_slug TEXT, author_name TEXT, author_title TEXT, author_photo TEXT, author_verified BOOLEAN,
  liked_by_me BOOLEAN
)
LANGUAGE sql STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT po.id, po.content, po.image_url, po.likes_count, po.comments_count, po.created_at,
    pr.id, pr.slug, pr.full_name, pr.title, pr.photo_url, pr.verified,
    EXISTS (SELECT 1 FROM post_likes l WHERE l.post_id = po.id AND l.practitioner_id = public.my_practitioner_id())
  FROM posts po
  JOIN practitioner_profiles pr ON pr.id = po.author_id
  WHERE pr.is_public
    AND (p_author_id IS NULL OR po.author_id = p_author_id)
    AND (p_before IS NULL OR po.created_at < p_before)
  ORDER BY po.created_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$$;
GRANT EXECUTE ON FUNCTION public.get_feed(INT, TIMESTAMPTZ, UUID) TO anon, authenticated;

-- Publicar (solo verificados)
CREATE OR REPLACE FUNCTION public.create_post(p_content TEXT, p_image_url TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid UUID; v_post UUID;
BEGIN
  SELECT id INTO v_pid FROM practitioner_profiles WHERE user_id = auth.uid() AND verified;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Solo médicos verificados pueden publicar'; END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN RAISE EXCEPTION 'El contenido no puede estar vacío'; END IF;
  INSERT INTO posts (author_id, content, image_url) VALUES (v_pid, btrim(p_content), p_image_url) RETURNING id INTO v_post;
  RETURN v_post;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_post(TEXT, TEXT) TO authenticated;

-- Like / unlike (toggle). Devuelve el nuevo estado (true = ahora con like)
CREATE OR REPLACE FUNCTION public.toggle_like(p_post_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid UUID; v_exists BOOLEAN;
BEGIN
  SELECT id INTO v_pid FROM practitioner_profiles WHERE user_id = auth.uid() AND verified;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT EXISTS (SELECT 1 FROM post_likes WHERE post_id = p_post_id AND practitioner_id = v_pid) INTO v_exists;
  IF v_exists THEN
    DELETE FROM post_likes WHERE post_id = p_post_id AND practitioner_id = v_pid;
    RETURN FALSE;
  ELSE
    INSERT INTO post_likes (post_id, practitioner_id) VALUES (p_post_id, v_pid);
    RETURN TRUE;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.toggle_like(UUID) TO authenticated;

-- Seguir / dejar de seguir (toggle)
CREATE OR REPLACE FUNCTION public.toggle_follow(p_following_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid UUID; v_exists BOOLEAN;
BEGIN
  SELECT id INTO v_pid FROM practitioner_profiles WHERE user_id = auth.uid() AND verified;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF v_pid = p_following_id THEN RAISE EXCEPTION 'No puedes seguirte a ti mismo'; END IF;
  SELECT EXISTS (SELECT 1 FROM follows WHERE follower_id = v_pid AND following_id = p_following_id) INTO v_exists;
  IF v_exists THEN
    DELETE FROM follows WHERE follower_id = v_pid AND following_id = p_following_id;
    RETURN FALSE;
  ELSE
    INSERT INTO follows (follower_id, following_id) VALUES (v_pid, p_following_id);
    RETURN TRUE;
  END IF;
END; $$;
GRANT EXECUTE ON FUNCTION public.toggle_follow(UUID) TO authenticated;

-- Comentar (solo verificados)
CREATE OR REPLACE FUNCTION public.add_comment(p_post_id UUID, p_content TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_pid UUID; v_cid UUID;
BEGIN
  SELECT id INTO v_pid FROM practitioner_profiles WHERE user_id = auth.uid() AND verified;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Solo médicos verificados pueden comentar'; END IF;
  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN RAISE EXCEPTION 'Comentario vacío'; END IF;
  INSERT INTO post_comments (post_id, author_id, content) VALUES (p_post_id, v_pid, btrim(p_content)) RETURNING id INTO v_cid;
  RETURN v_cid;
END; $$;
GRANT EXECUTE ON FUNCTION public.add_comment(UUID, TEXT) TO authenticated;
