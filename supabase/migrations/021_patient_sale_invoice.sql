-- ============================================
-- 021_patient_sale_invoice.sql
-- Actualiza patient_get_sale para incluir campos de factura electrónica.
-- (Originalmente en 015, agregamos los campos e_invoice_* aquí.)
-- ============================================

CREATE OR REPLACE FUNCTION public.patient_get_sale(
  p_token TEXT,
  p_sale_id UUID
)
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

  IF NOT EXISTS (
    SELECT 1 FROM sales WHERE id = p_sale_id AND patient_id = v_session.patient_id
  ) THEN
    RAISE EXCEPTION 'Recibo no encontrado';
  END IF;

  SELECT json_build_object(
    'sale', (
      SELECT json_build_object(
        'id', s.id, 'date', s.date, 'total', s.total,
        'payment_method', s.payment_method, 'status', s.status,
        'notes', s.notes, 'created_at', s.created_at,
        'appointment_id', s.appointment_id, 'jornada_id', s.jornada_id,
        'e_invoice_status', s.e_invoice_status,
        'e_invoice_number', s.e_invoice_number,
        'e_invoice_cufe', s.e_invoice_cufe,
        'e_invoice_pdf_url', s.e_invoice_pdf_url,
        'e_invoice_emitted_at', s.e_invoice_emitted_at
      )
      FROM sales s WHERE s.id = p_sale_id
    ),
    'items', (
      SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.created_at), '[]'::json)
      FROM (
        SELECT id, item_type, item_name, quantity, unit_price, subtotal, created_at
        FROM sale_items WHERE sale_id = p_sale_id
      ) i
    ),
    'payment', (
      SELECT row_to_json(p)
      FROM (
        SELECT id, reference, amount, status, payment_method,
               paid_at, payment_url, provider_transaction_id
        FROM payments
        WHERE sale_id = p_sale_id
        ORDER BY created_at DESC LIMIT 1
      ) p
    ),
    'clinic', (
      SELECT json_build_object(
        'name', t.name, 'phone', t.phone, 'address', t.address, 'city', t.city
      )
      FROM tenants t WHERE t.id = v_session.tenant_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
