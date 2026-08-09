-- ============================================
-- 038_patient_otp_disambiguation.sql
-- El acceso del paciente al portal no puede resolverse "a la primera"
--
-- PROBLEMA
-- `patient_otp_verify` buscaba al paciente así:
--
--   WHERE regexp_replace(p.phone,'\D','','g') LIKE '%' || RIGHT(telefono, 10)
--   ORDER BY p.created_at DESC
--   LIMIT 1;
--
-- Dos fallos:
--
--   1. `LIKE '%…'` compara por SUFIJO. Un número guardado como `13001234567`
--      hace match con quien entra como `3001234567`. Son personas distintas.
--
--   2. Cuando VARIOS pacientes comparten el mismo número —familiares, que es
--      lo habitual en un consultorio— el `LIMIT 1` entregaba la sesión al
--      registro más reciente, en silencio. Quien pedía el código veía la
--      HISTORIA CLÍNICA DE OTRA PERSONA. Hoy hay 1 número compartido por 2
--      pacientes en la base real; con 1.433 pacientes y 202 sin teléfono aún
--      por capturar, ese número solo puede crecer.
--
-- SOLUCIÓN
-- Comparación exacta de los últimos 10 dígitos, y si hay más de un paciente
-- con ese número NO se entrega sesión: se devuelve `ambiguous_phone` para que
-- el portal pida contactar al consultorio. Es preferible negar un acceso
-- legítimo a conceder uno equivocado sobre datos clínicos.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/038_patient_otp_disambiguation.sql
-- ============================================

CREATE OR REPLACE FUNCTION public.patient_otp_verify(
  p_phone TEXT,
  p_code TEXT,
  p_ip TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_code TEXT,
  session_token TEXT,
  patient_id UUID,
  tenant_id UUID,
  patient_name TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_phone_normalized TEXT;
  v_tail TEXT;
  v_code_hash TEXT;
  v_otp RECORD;
  v_new_attempts INT;
  v_patient RECORD;
  v_matches INT;
  v_token TEXT;
  v_token_hash TEXT;
  v_expires TIMESTAMPTZ;
BEGIN
  v_phone_normalized := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_tail := RIGHT(v_phone_normalized, 10);
  v_code_hash := encode(digest(COALESCE(p_code, ''), 'sha256'), 'hex');

  -- Bloquea la fila del OTP activo: serializa intentos concurrentes.
  SELECT * INTO v_otp
  FROM patient_otp_codes
  WHERE phone_normalized = v_phone_normalized
    AND consumed_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_otp.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'invalid_or_expired', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Incrementa y lee el valor FRESCO. Como la función RETORNA (no RAISE) en
  -- los caminos de fallo, este incremento HACE COMMIT.
  UPDATE patient_otp_codes
  SET attempts = attempts + 1
  WHERE id = v_otp.id
  RETURNING attempts INTO v_new_attempts;

  IF v_new_attempts > v_otp.max_attempts THEN
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RETURN QUERY SELECT FALSE, 'too_many_attempts', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_otp.code_hash <> v_code_hash THEN
    RETURN QUERY SELECT FALSE, 'wrong_code', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Código correcto. Comparación EXACTA de los últimos 10 dígitos.
  SELECT COUNT(*) INTO v_matches
  FROM patients p
  WHERE RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail
    AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10;

  -- Varias personas con el mismo número: el teléfono no basta para saber quién
  -- está entrando. No se entrega sesión.
  IF v_matches > 1 THEN
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RETURN QUERY SELECT FALSE, 'ambiguous_phone', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT p.id, p.full_name, p.tenant_id INTO v_patient
  FROM patients p
  WHERE RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail
    AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
  LIMIT 1;

  IF v_patient.id IS NULL THEN
    -- Consumir el OTP para evitar replay aunque no exista paciente.
    UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;
    RETURN QUERY SELECT FALSE, 'no_patient', NULL::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');
  v_expires := NOW() + INTERVAL '30 days';

  INSERT INTO patient_sessions (
    patient_id, tenant_id, token_hash, user_agent, ip_address, expires_at
  )
  VALUES (
    v_patient.id, v_patient.tenant_id, v_token_hash, p_user_agent, p_ip, v_expires
  );

  UPDATE patient_otp_codes SET consumed_at = NOW() WHERE id = v_otp.id;

  RETURN QUERY SELECT
    TRUE, NULL::TEXT, v_token, v_patient.id, v_patient.tenant_id, v_patient.full_name, v_expires;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.patient_otp_verify(TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Vista de apoyo para el consultorio: qué pacientes NO pueden entrar al portal
-- y por qué. Sirve para saber a quién hay que pedirle el celular.
CREATE OR REPLACE VIEW patient_portal_readiness
WITH (security_invoker = true) AS
WITH n AS (
  SELECT p.id, p.tenant_id, p.full_name, p.phone,
         regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') AS d
  FROM patients p
)
SELECT
  n.id, n.tenant_id, n.full_name, n.phone,
  CASE
    WHEN n.d = ''                                   THEN 'sin_telefono'
    WHEN length(n.d) < 10                           THEN 'telefono_incompleto'
    WHEN RIGHT(n.d, 10) !~ '^3[0-9]{9}$'            THEN 'no_es_celular'
    WHEN (SELECT COUNT(*) FROM n b
          WHERE RIGHT(b.d, 10) = RIGHT(n.d, 10)
            AND length(b.d) >= 10) > 1              THEN 'telefono_compartido'
    ELSE 'listo'
  END AS estado
FROM n;

COMMENT ON VIEW patient_portal_readiness IS
  'Por qué un paciente puede o no entrar al portal. estado=listo significa que con el WhatsApp conectado ya puede acceder.';
