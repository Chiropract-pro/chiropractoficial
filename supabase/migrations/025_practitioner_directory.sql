-- ============================================
-- 025_practitioner_directory.sql
-- Directorio de médicos registrados de chiropract.co.
--
-- Pivote de producto: chiropract.co deja de ser "la clínica de Miguel" y pasa a ser
-- una plataforma. El landing vende el software; los médicos (Miguel incluido) viven
-- en un directorio público. Cada médico verificado tendrá además perfil en la red
-- social profesional (fase C).
--
-- Un practitioner_profile puede existir con o sin tenant/usuario (para poder sembrar
-- a Miguel y para invitar a médicos que aún no se registran).
-- ============================================

CREATE TABLE IF NOT EXISTS practitioner_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,   -- consultorio en la plataforma (si tiene)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- cuenta (si se registró)

  slug TEXT UNIQUE NOT NULL,                 -- /dr/miguel-diaz
  full_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Dr.',          -- Dr. / Dra.
  headline TEXT,                             -- una línea: "Cuidado espinal integral · 15 años"
  bio TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',   -- ['Quiropraxia','Ortopedia funcional','Fisioterapia']
  city TEXT,
  country TEXT NOT NULL DEFAULT 'Colombia',
  photo_url TEXT,
  years_experience INT,

  -- Contacto / redes
  whatsapp TEXT,
  instagram TEXT,
  website TEXT,

  -- Estado en el directorio
  accepting_patients BOOLEAN NOT NULL DEFAULT TRUE,
  verified BOOLEAN NOT NULL DEFAULT FALSE,    -- verificado por el equipo (badge azul)
  is_public BOOLEAN NOT NULL DEFAULT TRUE,    -- visible en el directorio público
  featured BOOLEAN NOT NULL DEFAULT FALSE,    -- destacado (aparece primero)

  -- Métricas ligeras para la red social (fase C)
  followers_count INT NOT NULL DEFAULT 0,
  posts_count INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practitioners_public
  ON practitioner_profiles (featured DESC, verified DESC, full_name)
  WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_practitioners_city ON practitioner_profiles (country, city) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_practitioners_user ON practitioner_profiles (user_id);

DROP TRIGGER IF EXISTS practitioners_updated_at ON practitioner_profiles;
CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON practitioner_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- RLS
-- ============================================
ALTER TABLE practitioner_profiles ENABLE ROW LEVEL SECURITY;

-- Cualquiera (anon incl.) puede VER los perfiles públicos → directorio público
DROP POLICY IF EXISTS "public_read_practitioners" ON practitioner_profiles;
CREATE POLICY "public_read_practitioners" ON practitioner_profiles
  FOR SELECT TO anon, authenticated
  USING (is_public = TRUE);

-- El dueño puede editar SU perfil
DROP POLICY IF EXISTS "owner_update_practitioner" ON practitioner_profiles;
CREATE POLICY "owner_update_practitioner" ON practitioner_profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Un usuario autenticado puede crear su propio perfil
DROP POLICY IF EXISTS "owner_insert_practitioner" ON practitioner_profiles;
CREATE POLICY "owner_insert_practitioner" ON practitioner_profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- Seed: Dr. Miguel Ángel Díaz — el primer médico de la red
-- ============================================
INSERT INTO practitioner_profiles (
  slug, full_name, title, headline, bio, specialties, city, country,
  photo_url, years_experience, whatsapp, accepting_patients, verified, is_public, featured
)
VALUES (
  'miguel-diaz',
  'Miguel Ángel Díaz',
  'Dr.',
  'Cuidado espinal integral · Quiropraxia + Ortopedia + Fisioterapia',
  'Uno de los pocos especialistas colombianos que integra quiropraxia, ortopedia funcional y fisioterapia clínica en un solo método. 15 años perfeccionándolo, más de 500 pacientes tratados entre Bogotá y jornadas itinerantes en municipios de Boyacá. Su filosofía: la salud espinal es un derecho, no un lujo de la capital.',
  ARRAY['Quiropraxia', 'Ortopedia funcional', 'Fisioterapia clínica'],
  'Bogotá',
  'Colombia',
  '/images/dr-diaz/01-portrait-formal.jpg',
  15,
  '+573176305076',
  TRUE,   -- acepta pacientes
  TRUE,   -- verificado
  TRUE,   -- público
  TRUE    -- destacado (aparece primero)
)
ON CONFLICT (slug) DO UPDATE SET
  headline = EXCLUDED.headline,
  bio = EXCLUDED.bio,
  specialties = EXCLUDED.specialties,
  photo_url = EXCLUDED.photo_url,
  verified = TRUE, featured = TRUE, is_public = TRUE;

-- ============================================
-- RPC: get_practitioners — directorio público (paginable, con filtros)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_practitioners(
  p_city TEXT DEFAULT NULL,
  p_specialty TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50
)
RETURNS SETOF practitioner_profiles
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  SELECT * FROM practitioner_profiles
  WHERE is_public = TRUE
    AND (p_city IS NULL OR city ILIKE p_city)
    AND (p_specialty IS NULL OR p_specialty = ANY(specialties))
  ORDER BY featured DESC, verified DESC, full_name
  LIMIT GREATEST(1, LEAST(p_limit, 200));
$$;

GRANT EXECUTE ON FUNCTION public.get_practitioners(TEXT, TEXT, INT) TO anon, authenticated;
