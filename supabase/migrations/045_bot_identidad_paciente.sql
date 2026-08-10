-- ============================================
-- 045_bot_identidad_paciente.sql
-- El bot identificaba a quien escribía como OTRA persona
--
-- CÓMO SE DESTAPÓ
-- Sebastián escribió al WhatsApp del consultorio desde su número. El bot lo
-- reconoció como **Carmen Peña**, una paciente del consultorio de
-- DEMOSTRACIÓN, y montó toda la conversación sobre ese consultorio: la cita
-- que intentó agendar habría quedado invisible para la clínica real.
--
-- LA CAUSA
-- `resolve_inbound_phone` buscaba así:
--
--   WHERE regexp_replace(p.phone,'\D','','g') LIKE '%' || v_normalized
--      OR v_normalized LIKE '%' || regexp_replace(COALESCE(p.phone,''),'\D','','g')
--
-- La segunda condición es el desastre. Si `p.phone` es NULL, el lado derecho
-- queda vacío y la condición se vuelve `v_normalized LIKE '%'` — **verdadera
-- para todo el mundo**. Es decir: cualquier paciente sin teléfono captura a
-- cualquiera que escriba. Y el `ORDER BY length(p.phone) DESC` remataba,
-- porque en Postgres los NULL van primero en orden descendente: los pacientes
-- sin teléfono ganaban siempre.
--
-- Hoy hay **198 pacientes sin teléfono** en el consultorio real y 4 en el de
-- demostración. Cada uno es una trampa esperando.
--
-- POR QUÉ IMPORTA MÁS DE LO QUE PARECE
-- El bot tiene herramientas para consultar la próxima cita y los recibos del
-- paciente que reconoce. Con esta identificación equivocada, le habría leído a
-- un desconocido la agenda y los pagos de otra persona. Es la misma familia de
-- fallo que la migración 038 corrigió en el portal, y se corrige igual:
-- coincidencia EXACTA de los últimos 10 dígitos, y ante la duda no se entrega
-- identidad.
--
-- ADEMÁS
-- La función estaba duplicada (1 y 2 parámetros) y el consultorio se deducía
-- del paciente encontrado. Ahora el consultorio se resuelve por el número de
-- WhatsApp que recibió el mensaje, que es lo único que de verdad lo determina.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/045_bot_identidad_paciente.sql
-- ============================================

-- ── 1. Qué consultorio atiende cada línea de WhatsApp ───────────────────────
ALTER TABLE public.tenant_whatsapp_instances
  ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_whatsapp_instances_instancia
  ON public.tenant_whatsapp_instances (evolution_instance_id);

-- La línea que hoy usa el bot (Meta Cloud API, +57 317 8944493) pertenece al
-- consultorio del Dr. Miguel Ángel Díaz.
INSERT INTO public.tenant_whatsapp_instances
  (tenant_id, evolution_instance_id, evolution_instance_name, phone_number, wa_phone_number_id, active)
SELECT t.id, 'e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d', 'WABA Cloud API',
       '+573178944493', '1102408332962483', TRUE
FROM public.tenants t WHERE t.slug = 'dr-miguel-angel-diaz'
ON CONFLICT (evolution_instance_id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id,
      wa_phone_number_id = EXCLUDED.wa_phone_number_id,
      active = TRUE;

-- ── 2. Fuera las dos versiones anteriores ───────────────────────────────────
-- Se eliminan ambas: la de un parámetro sobraba, y la de dos no se puede
-- reemplazar en sitio porque cambia el tipo de retorno.
DROP FUNCTION IF EXISTS public.resolve_inbound_phone(TEXT);
DROP FUNCTION IF EXISTS public.resolve_inbound_phone(TEXT, TEXT);

-- ── 3. Identificación exacta, o ninguna ─────────────────────────────────────
CREATE FUNCTION public.resolve_inbound_phone(
  p_phone TEXT,
  p_evolution_instance_id TEXT DEFAULT NULL
)
RETURNS TABLE (tenant_id UUID, patient_id UUID, patient_name TEXT, conversation_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_digits  TEXT;
  v_tail    TEXT;
  v_tenant  UUID;
  v_patient UUID;
  v_name    TEXT;
  v_matches INT;
  v_conv    UUID;
BEGIN
  v_digits := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_tail   := RIGHT(v_digits, 10);

  IF length(v_digits) < 10 THEN
    RETURN;                     -- un número que no sirve no identifica a nadie
  END IF;

  -- El consultorio lo determina la LÍNEA que recibió el mensaje, nunca el
  -- paciente encontrado: si no, un registro del consultorio de demostración
  -- arrastraba toda la conversación a otro consultorio.
  SELECT i.tenant_id INTO v_tenant
  FROM tenant_whatsapp_instances i
  WHERE i.active
    AND (i.evolution_instance_id = p_evolution_instance_id
         OR i.wa_phone_number_id = p_evolution_instance_id)
  LIMIT 1;

  IF v_tenant IS NULL THEN
    -- Sin mapeo configurado, se atiende al consultorio con pacientes reales
    -- en vez de adivinar.
    SELECT p.tenant_id INTO v_tenant
    FROM patients p
    GROUP BY p.tenant_id
    ORDER BY count(*) DESC
    LIMIT 1;
  END IF;

  -- Coincidencia EXACTA de los últimos 10 dígitos, y solo entre teléfonos
  -- utilizables. Un teléfono vacío ya no coincide con nadie.
  SELECT count(*) INTO v_matches
  FROM patients p
  WHERE p.tenant_id = v_tenant
    AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
    AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail;

  -- Ante la duda (varias personas comparten el número), NO se entrega
  -- identidad: es preferible tratarlo como alguien nuevo que hablarle a un
  -- desconocido de la agenda y los pagos de otro.
  IF v_matches = 1 THEN
    SELECT p.id, p.full_name INTO v_patient, v_name
    FROM patients p
    WHERE p.tenant_id = v_tenant
      AND length(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')) >= 10
      AND RIGHT(regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g'), 10) = v_tail
    LIMIT 1;
  END IF;

  v_conv := public.upsert_whatsapp_conversation(
    v_tenant,
    CASE WHEN length(v_digits) = 10 THEN '57' || v_digits ELSE v_digits END,
    v_patient,
    p_evolution_instance_id
  );

  RETURN QUERY SELECT v_tenant, v_patient, v_name, v_conv;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_inbound_phone(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.resolve_inbound_phone(TEXT, TEXT) TO service_role;

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_n INT;
  r RECORD;
  v_real UUID;
BEGIN
  SELECT count(*) INTO v_n FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'resolve_inbound_phone';
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'Se esperaba 1 resolve_inbound_phone, hay %', v_n;
  END IF;

  SELECT id INTO v_real FROM tenants WHERE slug = 'dr-miguel-angel-diaz';

  -- Un número que no existe en ninguna ficha NO puede devolver paciente.
  SELECT * INTO r FROM resolve_inbound_phone('573999999999', 'e823bcaa-0a07-4fe5-a1b9-43ec4be54c8d');
  IF r.patient_id IS NOT NULL THEN
    RAISE EXCEPTION 'Un número desconocido devolvió el paciente %', r.patient_id;
  END IF;
  IF r.tenant_id <> v_real THEN
    RAISE EXCEPTION 'La línea resolvió al consultorio equivocado: %', r.tenant_id;
  END IF;

  -- La función abre conversación como efecto secundario, así que la
  -- comprobación deja un hilo con un número que no existe. Se limpia aquí
  -- mismo para no ensuciar la bandeja del consultorio.
  DELETE FROM whatsapp_messages
   WHERE conversation_id IN (SELECT id FROM whatsapp_conversations WHERE phone = '573999999999');
  DELETE FROM whatsapp_conversations WHERE phone = '573999999999';
END $$;
