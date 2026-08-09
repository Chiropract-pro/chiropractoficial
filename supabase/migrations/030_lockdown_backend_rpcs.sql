-- ============================================
-- 030_lockdown_backend_rpcs.sql
-- Segunda pasada de hardening, a partir de los Supabase advisors + prueba en vivo.
--
-- Hallazgo (advisor `anon_security_definer_function_executable` + exploit test):
--   Varias funciones SECURITY DEFINER de USO EXCLUSIVO del backend (Edge
--   Functions con service_role) eran ejecutables por el rol `anon` (¡sin login!)
--   vía PostgREST, por el GRANT implícito a PUBLIC que sus migraciones nunca
--   revocaron. La más grave: `patient_otp_create`, que DEVUELVE el código OTP en
--   texto plano -> anon podía pedir el código de cualquier teléfono y luego
--   verificarlo = secuestro de la sesión de cualquier paciente. La vuln #1 de la
--   auditoría era esta misma clase pero solo cubría las bot_*; aquí se cierra el
--   resto de la superficie sensible.
--
-- Segundo hallazgo (mismo exploit test): estas funciones fallaban en runtime con
--   `gen_random_bytes/digest does not exist` porque pgcrypto vive en el schema
--   `extensions` y su `search_path` era `public, pg_catalog` (lo excluye). Se
--   corrige el search_path para que el flujo OTP realmente funcione — y con él,
--   el arreglo de la vuln #2 (contador + CSPRNG).
--
-- Ninguna de estas 9 funciones se invoca desde el frontend (verificado en src/).
-- Quedan accesibles SOLO para service_role (Edge Functions / webhooks).
-- ============================================
DO $$
DECLARE
  r RECORD;
  fn_names TEXT[] := ARRAY[
    -- OTP / sesión del paciente (Edge Functions patient-*)
    'patient_otp_create', 'patient_otp_verify', 'patient_session_lookup',
    'patient_session_revoke', 'patient_get_dashboard',
    -- Pagos / facturación (webhooks wompi + alegra-emit-invoice)
    'apply_wompi_event', 'subscription_apply_payment',
    'get_billing_config_for_emit', 'get_sale_for_emit'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (fn_names)
  LOOP
    -- (a) Cerrar la exposición a anon/authenticated/PUBLIC; conservar service_role.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);

    -- (b) search_path fijo que incluye `extensions` para que pgcrypto
    --     (digest, gen_random_bytes) y uuid-ossp resuelvan dentro de la función.
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_catalog', r.sig);

    RAISE NOTICE 'Locked down + search_path fixed: %', r.sig;
  END LOOP;
END $$;
