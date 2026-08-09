-- ============================================
-- 034_lockdown_patient_rpcs.sql
-- Cierra el lockdown que quedó a medias.
--
-- 029 cubrió las bot_* y 030 otras 9 funciones de backend, pero quedaron fuera
-- 8 RPCs del panel del paciente, todas SECURITY DEFINER y ejecutables por `anon`
-- vía PostgREST. Con un session_token filtrado se podía leer la historia clínica
-- completa saltándose la Edge Function que valida la sesión.
--
-- Estas funciones son de uso EXCLUSIVO de las Edge Functions patient-* que
-- corren con service_role; el frontend nunca las llama directo (verificado).
-- ============================================
DO $$
DECLARE
  r RECORD;
  fn_names TEXT[] := ARRAY[
    'patient_cancel_appointment',
    'patient_request_reschedule',
    'patient_get_sale',
    'patient_update_profile',
    'patient_list_jornadas',
    'patient_book_jornada',
    'patient_get_clinical_history',
    'patient_get_file_storage_path'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY (fn_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    -- pgcrypto vive en el schema `extensions`; sin él en el search_path, las
    -- funciones que usan digest()/gen_random_bytes() fallan en runtime.
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_catalog', r.sig);
    RAISE NOTICE 'Bloqueada para anon: %', r.sig;
  END LOOP;
END $$;
