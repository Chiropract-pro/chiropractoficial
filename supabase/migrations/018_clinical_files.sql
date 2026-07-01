-- ============================================
-- 018_clinical_files.sql
-- FASE 2.2 — Archivos médicos (RX, exámenes, fotos clínicas)
--
-- Stack:
--   - Supabase Storage bucket "clinical-files" (privado, signed URLs)
--   - Tabla clinical_files: metadata (path, mime, size, kind, etc.)
--   - RLS por tenant_membership en BD; storage policies por path /{tenant_id}/...
--   - Soft delete (la HC es un documento legal — nunca se borra realmente)
-- ============================================

-- ============================================
-- 1. Tabla clinical_files — metadata
-- ============================================
CREATE TABLE IF NOT EXISTS clinical_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  clinical_record_id UUID REFERENCES clinical_records(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Storage
  storage_path TEXT NOT NULL UNIQUE,  -- "{tenant_id}/{patient_id}/{uuid}.ext"
  file_name TEXT NOT NULL,             -- nombre original mostrado al usuario
  file_size BIGINT NOT NULL CHECK (file_size > 0 AND file_size < 50 * 1024 * 1024), -- 50 MB max
  mime_type TEXT NOT NULL,

  -- Categorización clínica
  kind TEXT NOT NULL DEFAULT 'document'
    CHECK (kind IN ('rx', 'lab', 'photo', 'document', 'consent', 'other')),
  description TEXT,
  taken_at DATE,  -- fecha cuando se realizó el examen/RX (puede diferir del upload)

  -- Soft delete
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_files_patient
  ON clinical_files(patient_id, created_at DESC) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_files_record
  ON clinical_files(clinical_record_id) WHERE clinical_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_files_tenant
  ON clinical_files(tenant_id, created_at DESC) WHERE archived_at IS NULL;

DROP TRIGGER IF EXISTS clinical_files_updated_at ON clinical_files;
CREATE TRIGGER clinical_files_updated_at
  BEFORE UPDATE ON clinical_files
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================
-- 2. RLS — solo miembros del tenant
-- ============================================
ALTER TABLE clinical_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_clinical_files" ON clinical_files;
CREATE POLICY "tenant_members_clinical_files"
  ON clinical_files
  FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- ============================================
-- 3. Storage bucket "clinical-files" (privado)
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-files',
  'clinical-files',
  false,  -- privado, requiere signed URLs
  52428800, -- 50 MB
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/dicom'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- 4. Storage policies — solo tenant members pueden tocar archivos
-- en path "{tenant_id}/..."
--
-- Nota: los storage.objects tienen `name` = path completo. El primer path segment
-- es el tenant_id, así que validamos pertenencia con split_part.
-- ============================================

-- Permitir SELECT (download/view via signed URL):
DROP POLICY IF EXISTS "clinical_files_tenant_select" ON storage.objects;
CREATE POLICY "clinical_files_tenant_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Permitir INSERT (upload):
DROP POLICY IF EXISTS "clinical_files_tenant_insert" ON storage.objects;
CREATE POLICY "clinical_files_tenant_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'clinical-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Permitir DELETE (solo doctores/owners — equivalente al archive)
DROP POLICY IF EXISTS "clinical_files_tenant_delete" ON storage.objects;
CREATE POLICY "clinical_files_tenant_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'clinical-files'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
        AND role IN ('owner', 'admin', 'doctor')
    )
  );

-- ============================================
-- 5. RPC: clinical_file_register
-- Llamada después de subir el archivo a Storage. Registra el metadata.
-- ============================================
CREATE OR REPLACE FUNCTION public.clinical_file_register(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_storage_path TEXT,
  p_file_name TEXT,
  p_file_size BIGINT,
  p_mime_type TEXT,
  p_kind TEXT DEFAULT 'document',
  p_description TEXT DEFAULT NULL,
  p_taken_at DATE DEFAULT NULL,
  p_clinical_record_id UUID DEFAULT NULL
)
RETURNS clinical_files
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_file clinical_files%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este consultorio';
  END IF;

  -- Validación: el storage_path debe empezar con el tenant_id
  IF p_storage_path !~ ('^' || p_tenant_id::text || '/') THEN
    RAISE EXCEPTION 'storage_path inconsistente con tenant';
  END IF;

  INSERT INTO clinical_files (
    tenant_id, patient_id, clinical_record_id, uploaded_by,
    storage_path, file_name, file_size, mime_type,
    kind, description, taken_at
  )
  VALUES (
    p_tenant_id, p_patient_id, p_clinical_record_id, v_user,
    p_storage_path, p_file_name, p_file_size, p_mime_type,
    p_kind, p_description, p_taken_at
  )
  RETURNING * INTO v_file;

  RETURN v_file;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_file_register(
  UUID, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, DATE, UUID
) TO authenticated;

-- ============================================
-- 6. RPC: clinical_file_archive
-- ============================================
CREATE OR REPLACE FUNCTION public.clinical_file_archive(
  p_file_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tenant UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;

  SELECT tenant_id INTO v_tenant FROM clinical_files WHERE id = p_file_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Archivo no encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = v_tenant
      AND role IN ('owner', 'admin', 'doctor')
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo doctores/admin pueden archivar';
  END IF;

  UPDATE clinical_files SET
    archived_at = NOW(),
    archived_reason = p_reason
  WHERE id = p_file_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_file_archive(UUID, TEXT) TO authenticated;

-- ============================================
-- 7. RPC: clinical_file_signed_url
-- Genera una signed URL para descargar/visualizar (valida ownership por RLS)
-- ============================================
CREATE OR REPLACE FUNCTION public.clinical_file_get(p_file_id UUID)
RETURNS clinical_files
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT * FROM clinical_files
  WHERE id = p_file_id
    AND archived_at IS NULL
    AND tenant_id IN (
      SELECT tenant_id FROM tenant_memberships
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_file_get(UUID) TO authenticated;
