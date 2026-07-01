-- ============================================
-- 012_bot_tools_rpcs.sql
-- RPCs que el AI Agent del bot WhatsApp puede llamar como tools.
-- Cada función está diseñada para ser invocada por n8n con mínima fricción.
-- ============================================

-- ============================================
-- TOOL 1: reconocer_paciente_por_phone
-- Busca paciente por teléfono y retorna datos completos para contexto
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_recognize_patient(p_phone TEXT)
RETURNS TABLE (
  patient_id UUID,
  tenant_id UUID,
  full_name TEXT,
  email TEXT,
  city TEXT,
  status TEXT,
  treatment TEXT,
  total_visits INT,
  last_visit DATE,
  is_vip BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_normalized) > 10 AND v_normalized LIKE '57%' THEN
    v_normalized := substring(v_normalized FROM 3);
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.tenant_id,
    p.full_name,
    p.email,
    p.city,
    p.status,
    p.treatment,
    p.appointments_count,
    p.last_visit,
    p.vip
  FROM patients p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
     OR v_normalized LIKE '%' || regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')
  ORDER BY length(p.phone) DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_recognize_patient(TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 2: bot_upcoming_appointments_by_phone
-- Próximas citas del paciente (no solo la siguiente)
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_upcoming_appointments(p_phone TEXT, p_limit INT DEFAULT 3)
RETURNS TABLE (
  appointment_id UUID,
  appointment_date DATE,
  appointment_time TIME,
  appointment_type TEXT,
  type_label TEXT,
  location TEXT,
  status TEXT,
  price BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');

  RETURN QUERY
  SELECT a.id, a.date, a.time, a.type,
    CASE a.type
      WHEN 'primera_consulta' THEN 'Primera consulta'
      WHEN 'seguimiento' THEN 'Seguimiento'
      WHEN 'jornada' THEN 'Jornada'
      WHEN 'emergencia' THEN 'Emergencia'
      ELSE a.type
    END,
    a.location,
    a.status,
    a.price
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
    AND a.date >= CURRENT_DATE
    AND a.status IN ('pendiente', 'confirmada')
  ORDER BY a.date ASC, a.time ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_upcoming_appointments(TEXT, INT) TO service_role, authenticated;

-- ============================================
-- TOOL 3: bot_upcoming_jornadas
-- Próximas jornadas con cupos disponibles
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_upcoming_jornadas(p_tenant_id UUID, p_city TEXT DEFAULT NULL, p_limit INT DEFAULT 5)
RETURNS TABLE (
  jornada_id UUID,
  city TEXT,
  jornada_date DATE,
  capacity INT,
  booked INT,
  available INT,
  price_per_patient BIGINT,
  status TEXT,
  notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT j.id, j.city, j.date, j.capacity, j.booked,
    GREATEST(j.capacity - j.booked, 0)::INT,
    j.price_per_patient, j.status, j.notes
  FROM jornadas j
  WHERE j.tenant_id = p_tenant_id
    AND j.date >= CURRENT_DATE
    AND j.status = 'programada'
    AND (p_city IS NULL OR lower(j.city) LIKE '%' || lower(p_city) || '%')
  ORDER BY j.date ASC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_upcoming_jornadas(UUID, TEXT, INT) TO service_role, authenticated;

-- ============================================
-- TOOL 4: bot_active_services
-- Catálogo de servicios activos con precios
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_active_services(p_tenant_id UUID)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  description TEXT,
  category TEXT,
  price BIGINT,
  duration_min INT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT id, name, description, category, price, duration_min
  FROM services
  WHERE tenant_id = p_tenant_id AND active = TRUE
  ORDER BY category, price;
$$;

GRANT EXECUTE ON FUNCTION public.bot_active_services(UUID) TO service_role, authenticated;

-- ============================================
-- TOOL 5: bot_request_appointment
-- Crea una cita PENDIENTE con info pre-cargada (recepción confirma después)
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_request_appointment(
  p_tenant_id UUID,
  p_patient_id UUID,
  p_patient_name TEXT,
  p_date DATE,
  p_time TIME,
  p_type TEXT,
  p_location TEXT DEFAULT 'consultorio',
  p_notes TEXT DEFAULT NULL
)
RETURNS appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_appt appointments%ROWTYPE;
  v_price BIGINT;
BEGIN
  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'No se puede agendar en fechas pasadas';
  END IF;

  -- Precio default por tipo
  v_price := CASE p_type
    WHEN 'primera_consulta' THEN 150000
    WHEN 'seguimiento' THEN 100000
    WHEN 'jornada' THEN 150000
    WHEN 'emergencia' THEN 200000
    ELSE 100000
  END;

  INSERT INTO appointments (
    tenant_id, patient_id, patient_name,
    date, time, type, location, status, price, notes
  )
  VALUES (
    p_tenant_id, p_patient_id, p_patient_name,
    p_date, p_time, p_type, COALESCE(p_location, 'consultorio'),
    'pendiente', v_price,
    COALESCE(p_notes, '') || ' [Solicitada vía WhatsApp]'
  )
  RETURNING * INTO v_appt;

  -- Crear alerta para recepción
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    p_tenant_id, 'info',
    'Nueva cita solicitada por WhatsApp: ' || p_patient_name || ' para ' || p_date,
    'review_appointment', v_appt.id
  );

  RETURN v_appt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_request_appointment(UUID, UUID, TEXT, DATE, TIME, TEXT, TEXT, TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 6: bot_request_reschedule
-- Marca una cita para reagendar (no la mueve, crea alerta)
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_request_reschedule(
  p_appointment_id UUID,
  p_preferred_date DATE DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tenant UUID;
  v_name TEXT;
BEGIN
  SELECT tenant_id, patient_name INTO v_tenant, v_name FROM appointments WHERE id = p_appointment_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    v_tenant, 'warning',
    v_name || ' solicita reagendar' ||
    COALESCE(' (preferencia: ' || p_preferred_date::TEXT || ')', '') ||
    COALESCE(' — motivo: ' || p_reason, ''),
    'reschedule_appointment', p_appointment_id
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_request_reschedule(UUID, DATE, TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 7: bot_cancel_appointment
-- Cancela cita inmediatamente (desde el chat)
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_cancel_appointment(p_appointment_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_tenant UUID;
  v_name TEXT;
BEGIN
  UPDATE appointments
  SET status = 'cancelada',
      notes = COALESCE(notes, '') || E'\n[Cancelada vía WhatsApp' ||
              COALESCE(': ' || p_reason, '') || ']'
  WHERE id = p_appointment_id
  RETURNING tenant_id, patient_name INTO v_tenant, v_name;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Cita no encontrada';
  END IF;

  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (v_tenant, 'info', v_name || ' canceló su cita por WhatsApp', 'view_appointment', p_appointment_id);

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_cancel_appointment(UUID, TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 8: bot_register_lead
-- Registra un lead nuevo cuando alguien pregunta sin estar registrado
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_register_lead(
  p_tenant_id UUID,
  p_name TEXT,
  p_phone TEXT,
  p_city TEXT DEFAULT NULL,
  p_motivo TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'whatsapp'
)
RETURNS leads
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_lead leads%ROWTYPE;
BEGIN
  INSERT INTO leads (tenant_id, name, source, status, notes)
  VALUES (
    p_tenant_id,
    COALESCE(NULLIF(trim(p_name), ''), 'Lead WhatsApp'),
    COALESCE(p_source, 'whatsapp'),
    'nuevo',
    'Tel: ' || p_phone ||
    COALESCE(E'\nCiudad: ' || p_city, '') ||
    COALESCE(E'\nMotivo: ' || p_motivo, '')
  )
  RETURNING * INTO v_lead;

  -- Alerta a recepción
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    p_tenant_id, 'info',
    'Nuevo lead vía WhatsApp: ' || p_name ||
    COALESCE(' (' || p_city || ')', ''),
    'view_lead', v_lead.id
  );

  RETURN v_lead;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_register_lead(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 9: bot_escalate_to_human
-- Marca conversación para atención humana inmediata
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_escalate_to_human(
  p_tenant_id UUID,
  p_phone TEXT,
  p_patient_name TEXT,
  p_reason TEXT,
  p_urgency TEXT DEFAULT 'normal'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_alert_type TEXT;
BEGIN
  v_alert_type := CASE p_urgency
    WHEN 'urgent' THEN 'danger'
    WHEN 'high' THEN 'warning'
    ELSE 'info'
  END;

  -- Marcar conversación como escalada
  UPDATE whatsapp_conversations
  SET state = 'escalated_to_human',
      metadata = metadata || jsonb_build_object('escalated_at', NOW(), 'reason', p_reason, 'urgency', p_urgency)
  WHERE tenant_id = p_tenant_id
    AND phone = regexp_replace(p_phone, '\D', '', 'g');

  -- Alerta visible en CRM
  INSERT INTO alerts (tenant_id, type, message, action, reference_id)
  VALUES (
    p_tenant_id, v_alert_type,
    '🚨 ' || p_patient_name || ' necesita atención humana' ||
    COALESCE(': ' || p_reason, ''),
    'open_whatsapp_conversation', NULL
  );

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_escalate_to_human(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role, authenticated;

-- ============================================
-- TOOL 10: bot_get_recent_receipts
-- Lista los últimos recibos del paciente para que pueda escoger uno
-- ============================================
CREATE OR REPLACE FUNCTION public.bot_get_recent_receipts(p_phone TEXT, p_limit INT DEFAULT 5)
RETURNS TABLE (
  sale_id UUID,
  sale_date DATE,
  total BIGINT,
  payment_method TEXT,
  items_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_normalized TEXT;
BEGIN
  v_normalized := regexp_replace(p_phone, '\D', '', 'g');

  RETURN QUERY
  SELECT
    s.id, s.date, s.total, s.payment_method,
    COALESCE(string_agg(si.item_name, ', '), '')
  FROM sales s
  JOIN patients p ON p.id = s.patient_id
  LEFT JOIN sale_items si ON si.sale_id = s.id
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || v_normalized
    AND s.status = 'completada'
  GROUP BY s.id, s.date, s.total, s.payment_method
  ORDER BY s.date DESC
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bot_get_recent_receipts(TEXT, INT) TO service_role, authenticated;
