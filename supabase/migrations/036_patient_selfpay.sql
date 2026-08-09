-- ============================================
-- 036_patient_selfpay.sql
-- El paciente ve su saldo pendiente en su portal y lo paga solo.
--
-- Contexto: la digitalización del histórico dejó `patients.balance_due` con la
-- deuda REAL (solo cuando la agenda decía "Debe"/"Saldo"): 33 pacientes,
-- $4.107.035. Hasta ahora esa plata solo era visible para el consultorio y
-- requería que alguien generara el link a mano.
--
-- Cambio: `patient_get_dashboard` ahora devuelve también `balance_due`, para que
-- el portal pueda mostrarlo y ofrecer el botón de pago.
-- ============================================

CREATE OR REPLACE FUNCTION public.patient_get_dashboard(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_session RECORD;
  v_result JSON;
BEGIN
  SELECT patient_id, tenant_id INTO v_session
  FROM public.patient_session_lookup(p_token)
  LIMIT 1;

  IF v_session.patient_id IS NULL THEN
    RAISE EXCEPTION 'Sesión inválida';
  END IF;

  SELECT json_build_object(
    'patient', (
      SELECT json_build_object(
        'id', p.id, 'full_name', p.full_name, 'email', p.email,
        'phone', p.phone, 'address', p.address, 'city', p.city,
        'total_spent', p.total_spent, 'appointments_count', p.appointments_count,
        -- NUEVO: saldo confirmado, para que el paciente pueda pagarlo desde el portal
        'balance_due', COALESCE(p.balance_due, 0)
      )
      FROM patients p WHERE p.id = v_session.patient_id
    ),
    'upcoming_appointments', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT a.id, a.date, a.time, a.type, a.status, a.location, a.price,
               COALESCE(prof.full_name, 'Por asignar') AS doctor_name
        FROM appointments a
        LEFT JOIN profiles prof ON prof.id = a.assigned_doctor_id
        WHERE a.patient_id = v_session.patient_id
          AND a.date >= CURRENT_DATE
          AND a.status IN ('pendiente', 'confirmada')
        ORDER BY a.date ASC, a.time ASC
        LIMIT 10
      ) t
    ),
    'recent_sales', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT s.id, s.created_at, s.total, s.status, s.payment_method
        FROM sales s
        WHERE s.patient_id = v_session.patient_id
        ORDER BY s.created_at DESC
        LIMIT 10
      ) t
    ),
    'pending_payments', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT pay.id, pay.amount, pay.description, pay.payment_url,
               pay.expires_at, pay.created_at
        FROM payments pay
        WHERE pay.patient_id = v_session.patient_id
          AND pay.status = 'pending'
          AND (pay.expires_at IS NULL OR pay.expires_at > NOW())
        ORDER BY pay.created_at DESC
      ) t
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Backend-only (la llama la Edge Function del portal con service_role).
REVOKE EXECUTE ON FUNCTION public.patient_get_dashboard(TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.patient_get_dashboard(TEXT) TO service_role;
