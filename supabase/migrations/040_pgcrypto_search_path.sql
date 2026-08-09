-- ============================================
-- 040_pgcrypto_search_path.sql
-- pgcrypto vive en el esquema `extensions`: sin él en el search_path, la
-- función revienta en tiempo de ejecución
--
-- EL PATRÓN (ya conocido, y por eso duele que se repita)
-- En este proyecto pgcrypto NO está en `public`, está en `extensions`. Toda
-- función `SECURITY DEFINER` que use `gen_random_bytes`, `digest`, `crypt` o
-- `hmac` necesita `extensions` en su `SET search_path`, o falla con:
--     42883: function gen_random_bytes(integer) does not exist
-- La migración 030 lo arregló para 9 funciones. Estas dos quedaron fuera:
--
-- 1. `create_payment_intent` — nunca se corrigió. Consecuencia real: **los
--    cobros con Bold no han funcionado nunca** desde el endurecimiento de
--    seguridad. La Edge Function devolvía «No se pudo crear el intento de
--    pago» con llaves de Bold perfectamente válidas (comprobado: la misma
--    llave contra la API de Bold responde HTTP 200), porque el fallo ocurría
--    al generar la referencia del pago, antes de salir a la pasarela.
--
-- 2. `patient_otp_verify` — se corrigió en la 030 y la migración 038 la volvió
--    a romper: al reescribir la función para arreglar el teléfono compartido
--    se copió el encabezado de la 029, que traía el search_path antiguo. Sin
--    esto, ningún paciente puede entrar al portal.
--
-- LECCIÓN: al reescribir con CREATE OR REPLACE una función ya endurecida, hay
-- que copiar el encabezado de la ÚLTIMA versión, no de la original.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/040_pgcrypto_search_path.sql
-- ============================================

ALTER FUNCTION public.create_payment_intent(
  UUID, BIGINT, TEXT, UUID, UUID, UUID, TEXT, TEXT, UUID, TEXT
) SET search_path = public, extensions, pg_catalog;

ALTER FUNCTION public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT)
  SET search_path = public, extensions, pg_catalog;

-- Comprobación: ninguna función de `public` que use pgcrypto puede quedarse
-- sin `extensions` en su search_path.
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ')
    INTO v_bad
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosrc ~ '(gen_random_bytes|digest\(|crypt\(|hmac\()'
    AND (p.proconfig IS NULL
         OR NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE '%extensions%'));

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Siguen sin extensions en el search_path: %', v_bad;
  END IF;
END $$;
