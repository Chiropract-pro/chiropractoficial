-- ============================================
-- 039_fix_payment_intent_ambiguity.sql
-- Los cobros con Bold fallaban por una función duplicada
--
-- SÍNTOMA
-- `bold-create-link` devolvía 500 «No se pudo crear el intento de pago» con
-- llaves de Bold perfectamente válidas — comprobado llamando a la API de Bold
-- directamente con la misma llave: HTTP 200. El fallo estaba antes de salir a
-- la pasarela.
--
-- CAUSA
-- Existían DOS `create_payment_intent` en el esquema, con la misma lista de
-- parámetros salvo dos añadidos al final:
--
--   (tenant, amount, description, patient, appointment, jornada, email, phone)
--   (… los mismos …, subscription_id DEFAULT NULL, purpose DEFAULT 'sale')
--
-- Como los dos últimos tienen valor por defecto, una llamada con 8 argumentos
-- encaja en AMBAS. PostgREST no puede resolver a cuál llamar y responde con un
-- error de función no única, que la Edge Function traducía a su mensaje
-- genérico. La versión de 10 parámetros llegó con las suscripciones
-- (022_saas_subscriptions) y la de 8 quedó viva de antes.
--
-- SOLUCIÓN
-- Se elimina la versión de 8 parámetros. La de 10 la cubre por completo: con 8
-- argumentos, `p_subscription_id` queda NULL y `p_purpose` queda 'sale', que es
-- exactamente lo que hacía la antigua.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/039_fix_payment_intent_ambiguity.sql
-- ============================================

DROP FUNCTION IF EXISTS public.create_payment_intent(
  UUID,    -- p_tenant_id
  BIGINT,  -- p_amount
  TEXT,    -- p_description
  UUID,    -- p_patient_id
  UUID,    -- p_appointment_id
  UUID,    -- p_jornada_id
  TEXT,    -- p_customer_email
  TEXT     -- p_customer_phone
);

-- Comprobación: debe quedar exactamente una.
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM pg_proc WHERE proname = 'create_payment_intent';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 create_payment_intent, hay %', v_count;
  END IF;
END $$;
