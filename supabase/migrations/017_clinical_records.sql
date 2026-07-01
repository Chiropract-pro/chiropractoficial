-- ============================================
-- 017_clinical_records.sql
-- FASE 2.1 — Historia Clínica con notas SOAP
--
-- SOAP es el estándar internacional:
--   S - Subjective: lo que el paciente reporta (síntomas, dolor, antecedentes)
--   O - Objective: hallazgos del examen (palpación, ROM, postura, tests)
--   A - Assessment: diagnóstico clínico
--   P - Plan: plan de tratamiento, ajustes, próximos pasos
--
-- Cada record puede vincularse a una cita específica (1-1) o ser stand-alone.
-- Soporta:
--   - Signos vitales opcionales (peso, talla, TA)
--   - Anotaciones de dolor en diagrama corporal (JSONB)
--   - Códigos CIE-10 (array de TEXT)
-- ============================================

CREATE TABLE IF NOT EXISTS clinical_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- SOAP
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,

  -- Signos vitales opcionales
  weight_kg NUMERIC(5, 2),
  height_cm INT CHECK (height_cm IS NULL OR (height_cm BETWEEN 30 AND 250)),
  blood_pressure_systolic INT CHECK (blood_pressure_systolic IS NULL OR (blood_pressure_systolic BETWEEN 50 AND 260)),
  blood_pressure_diastolic INT CHECK (blood_pressure_diastolic IS NULL OR (blood_pressure_diastolic BETWEEN 30 AND 160)),
  heart_rate INT CHECK (heart_rate IS NULL OR (heart_rate BETWEEN 30 AND 220)),

  -- Body diagram annotations
  -- Esquema: [
  --   { "side": "front" | "back",
  --     "x": 0..1 (porcentaje horizontal),
  --     "y": 0..1 (porcentaje vertical),
  --     "intensity": 1..10,
  --     "type": "agudo" | "sordo" | "irradiado" | "punzante" | "ardiente",
  --     "notes": "texto libre"
  --   }
  -- ]
  pain_points JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Códigos CIE-10 (ej. ['M54.5', 'M62.83'])
  diagnosis_codes TEXT[] DEFAULT '{}',

  -- Soft delete (para historia: nunca borrar — solo archivar)
  archived_at TIMESTAMPTZ,
  archived_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_records_patient
  ON clinical_records(patient_id, created_at DESC) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_records_tenant_date
  ON clinical_records(tenant_id, created_at DESC) WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_records_appointment
  ON clinical_records(appointment_id) WHERE appointment_id IS NOT NULL;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS clinical_records_updated_at ON clinical_records;
CREATE TRIGGER clinical_records_updated_at
  BEFORE UPDATE ON clinical_records
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================
-- RLS: solo miembros del tenant pueden ver/editar
-- ============================================
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_members_clinical_records" ON clinical_records;
CREATE POLICY "tenant_members_clinical_records"
  ON clinical_records
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
-- RPC: clinical_record_upsert
-- Crea o actualiza un record. Si appointment_id se da y ya existe un record
-- para esa cita, actualiza ese record en vez de crear duplicado.
-- ============================================
CREATE OR REPLACE FUNCTION public.clinical_record_upsert(
  p_record_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_appointment_id UUID DEFAULT NULL,
  p_subjective TEXT DEFAULT NULL,
  p_objective TEXT DEFAULT NULL,
  p_assessment TEXT DEFAULT NULL,
  p_plan TEXT DEFAULT NULL,
  p_weight_kg NUMERIC DEFAULT NULL,
  p_height_cm INT DEFAULT NULL,
  p_bp_systolic INT DEFAULT NULL,
  p_bp_diastolic INT DEFAULT NULL,
  p_heart_rate INT DEFAULT NULL,
  p_pain_points JSONB DEFAULT NULL,
  p_diagnosis_codes TEXT[] DEFAULT NULL
)
RETURNS clinical_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_record clinical_records%ROWTYPE;
  v_target_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Verifica membership en el tenant
  IF p_tenant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = p_tenant_id AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'No tienes acceso a este consultorio';
  END IF;

  -- Caso 1: actualizar por record_id explícito
  IF p_record_id IS NOT NULL THEN
    v_target_id := p_record_id;

  -- Caso 2: si hay appointment_id, buscar record existente para esa cita
  ELSIF p_appointment_id IS NOT NULL THEN
    SELECT id INTO v_target_id FROM clinical_records
    WHERE appointment_id = p_appointment_id AND archived_at IS NULL
    LIMIT 1;
  END IF;

  IF v_target_id IS NOT NULL THEN
    UPDATE clinical_records SET
      subjective = COALESCE(p_subjective, subjective),
      objective = COALESCE(p_objective, objective),
      assessment = COALESCE(p_assessment, assessment),
      plan = COALESCE(p_plan, plan),
      weight_kg = COALESCE(p_weight_kg, weight_kg),
      height_cm = COALESCE(p_height_cm, height_cm),
      blood_pressure_systolic = COALESCE(p_bp_systolic, blood_pressure_systolic),
      blood_pressure_diastolic = COALESCE(p_bp_diastolic, blood_pressure_diastolic),
      heart_rate = COALESCE(p_heart_rate, heart_rate),
      pain_points = COALESCE(p_pain_points, pain_points),
      diagnosis_codes = COALESCE(p_diagnosis_codes, diagnosis_codes)
    WHERE id = v_target_id
    RETURNING * INTO v_record;
  ELSE
    -- Crear nuevo
    IF p_tenant_id IS NULL OR p_patient_id IS NULL THEN
      RAISE EXCEPTION 'tenant_id y patient_id son obligatorios al crear';
    END IF;

    INSERT INTO clinical_records (
      tenant_id, patient_id, appointment_id, doctor_id,
      subjective, objective, assessment, plan,
      weight_kg, height_cm,
      blood_pressure_systolic, blood_pressure_diastolic, heart_rate,
      pain_points, diagnosis_codes
    )
    VALUES (
      p_tenant_id, p_patient_id, p_appointment_id, v_user,
      p_subjective, p_objective, p_assessment, p_plan,
      p_weight_kg, p_height_cm,
      p_bp_systolic, p_bp_diastolic, p_heart_rate,
      COALESCE(p_pain_points, '[]'::jsonb),
      COALESCE(p_diagnosis_codes, '{}')
    )
    RETURNING * INTO v_record;
  END IF;

  RETURN v_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_record_upsert(
  UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT,
  NUMERIC, INT, INT, INT, INT, JSONB, TEXT[]
) TO authenticated;

-- ============================================
-- RPC: clinical_record_archive
-- Soft-delete (para mantener integridad de historia clínica).
-- ============================================
CREATE OR REPLACE FUNCTION public.clinical_record_archive(
  p_record_id UUID,
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

  SELECT tenant_id INTO v_tenant FROM clinical_records WHERE id = p_record_id;
  IF v_tenant IS NULL THEN RAISE EXCEPTION 'Record no encontrado'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_memberships
    WHERE user_id = v_user AND tenant_id = v_tenant
      AND role IN ('owner', 'admin', 'doctor')
      AND accepted_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Solo doctores pueden archivar registros';
  END IF;

  UPDATE clinical_records SET
    archived_at = NOW(),
    archived_reason = p_reason
  WHERE id = p_record_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clinical_record_archive(UUID, TEXT) TO authenticated;

-- ============================================
-- VIEW: patient_clinical_summary
-- Resumen rápido para mostrar en el detalle del paciente
-- ============================================
CREATE OR REPLACE VIEW public.patient_clinical_summary AS
SELECT
  cr.patient_id,
  cr.tenant_id,
  COUNT(*) FILTER (WHERE cr.archived_at IS NULL) AS records_count,
  MAX(cr.created_at) FILTER (WHERE cr.archived_at IS NULL) AS last_record_at,
  array_agg(DISTINCT cr.diagnosis_codes) FILTER (WHERE cr.archived_at IS NULL AND cr.diagnosis_codes IS NOT NULL)
    AS recent_diagnoses
FROM clinical_records cr
GROUP BY cr.patient_id, cr.tenant_id;

GRANT SELECT ON public.patient_clinical_summary TO authenticated;
