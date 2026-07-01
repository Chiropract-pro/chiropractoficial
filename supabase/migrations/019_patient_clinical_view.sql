-- ============================================
-- 019_patient_clinical_view.sql
-- FASE 2.3 — El paciente puede ver SU PROPIA historia clínica
-- desde el panel del paciente (read-only).
--
-- Retorna SOAP + signos vitales + pain_points + diagnóstico CIE-10 +
-- metadata de archivos (sin URL — el Edge Function genera signed URL on-demand).
-- ============================================

CREATE OR REPLACE FUNCTION public.patient_get_clinical_history(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_result JSON;
BEGIN
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT json_build_object(
    'records', (
      SELECT COALESCE(json_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::json)
      FROM (
        SELECT
          cr.id,
          cr.created_at,
          cr.subjective,
          cr.objective,
          cr.assessment,
          cr.plan,
          cr.weight_kg,
          cr.height_cm,
          cr.blood_pressure_systolic,
          cr.blood_pressure_diastolic,
          cr.heart_rate,
          cr.pain_points,
          cr.diagnosis_codes,
          COALESCE(prof.full_name, 'Doctor') AS doctor_name,
          a.date AS appointment_date,
          a.time AS appointment_time,
          (
            SELECT COUNT(*) FROM clinical_files cf
            WHERE cf.clinical_record_id = cr.id AND cf.archived_at IS NULL
          ) AS files_count
        FROM clinical_records cr
        LEFT JOIN profiles prof ON prof.id = cr.doctor_id
        LEFT JOIN appointments a ON a.id = cr.appointment_id
        WHERE cr.patient_id = v_session.patient_id
          AND cr.archived_at IS NULL
        ORDER BY cr.created_at DESC
        LIMIT 50
      ) r
    ),
    'files', (
      SELECT COALESCE(json_agg(row_to_json(f) ORDER BY f.created_at DESC), '[]'::json)
      FROM (
        SELECT
          cf.id,
          cf.file_name,
          cf.file_size,
          cf.mime_type,
          cf.kind,
          cf.description,
          cf.taken_at,
          cf.created_at,
          cf.clinical_record_id
        FROM clinical_files cf
        WHERE cf.patient_id = v_session.patient_id
          AND cf.archived_at IS NULL
        ORDER BY cf.created_at DESC
        LIMIT 100
      ) f
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_get_clinical_history(TEXT) TO service_role;

-- ============================================
-- RPC: patient_get_file_storage_path
-- Devuelve el storage_path SOLO si el archivo pertenece al paciente.
-- El Edge Function lo usa para generar signed URL via service role.
-- ============================================
CREATE OR REPLACE FUNCTION public.patient_get_file_storage_path(
  p_token TEXT,
  p_file_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_path TEXT;
BEGIN
  SELECT patient_id INTO v_session
  FROM public.patient_session_lookup(p_token) LIMIT 1;
  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT cf.storage_path INTO v_path
  FROM clinical_files cf
  WHERE cf.id = p_file_id
    AND cf.patient_id = v_session.patient_id
    AND cf.archived_at IS NULL;

  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Archivo no encontrado';
  END IF;

  RETURN v_path;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_get_file_storage_path(TEXT, UUID) TO service_role;
