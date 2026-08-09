-- ============================================
-- 033_sales_to_transactions.sql
-- BUG CRÍTICO DE NEGOCIO: Finanzas estaba ciega.
--
-- Nada en el sistema escribía en `transactions` salvo el formulario manual
-- "Registrar ingreso". Ni las ventas del módulo Productos/Servicios, ni las
-- ventas creadas automáticamente al aprobarse un pago en línea (Wompi/Bold).
-- Resultado: el doctor registraba una venta de $150.000 y en Finanzas seguía
-- viendo "Ingresos hoy: $0". La meta del mes, la comparativa de 6 meses y todos
-- los indicadores solo reflejaban lo tecleado a mano.
--
-- Solución: un trigger sobre `sales` que mantiene el ingreso correspondiente en
-- `transactions`. Cubre los tres caminos (venta manual, Wompi, Bold) de una vez,
-- porque todos terminan insertando en `sales`.
--
-- Idempotente y sin duplicar: la transacción generada se vincula a la venta por
-- `sale_id`, con índice único.
-- ============================================

-- Vínculo explícito venta -> transacción (permite actualizar/borrar sin duplicar)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES sales(id) ON DELETE CASCADE;
-- Índice único NO parcial: ON CONFLICT solo puede inferir sobre índices completos.
-- Los NULL son distintos entre sí, así que las transacciones manuales (sin venta)
-- no chocan entre ellas.
DROP INDEX IF EXISTS ux_transactions_sale;
CREATE UNIQUE INDEX IF NOT EXISTS ux_transactions_sale ON transactions(sale_id);

CREATE OR REPLACE FUNCTION public.tg_sale_sync_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_category TEXT;
BEGIN
  -- Una venta de jornada se categoriza como tal; el resto, consultorio.
  v_category := CASE WHEN NEW.jornada_id IS NOT NULL THEN 'jornada' ELSE 'consultorio' END;

  -- Solo las ventas completadas cuentan como ingreso.
  IF NEW.status = 'completada' THEN
    INSERT INTO transactions (tenant_id, patient_id, appointment_id, sale_id, type, category, amount, description, date)
    VALUES (
      NEW.tenant_id, NEW.patient_id, NEW.appointment_id, NEW.id,
      'income', v_category, NEW.total,
      COALESCE(NULLIF(NEW.notes, ''), 'Venta ' || COALESCE(NEW.payment_method, '')),
      COALESCE(NEW.date, CURRENT_DATE)
    )
    ON CONFLICT (sale_id) DO UPDATE
      SET amount = EXCLUDED.amount,
          date = EXCLUDED.date,
          category = EXCLUDED.category,
          patient_id = EXCLUDED.patient_id,
          description = EXCLUDED.description;
  ELSE
    -- Venta anulada/pendiente: retirar el ingreso si existía.
    DELETE FROM transactions WHERE sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_sync_transaction ON sales;
CREATE TRIGGER sales_sync_transaction
  AFTER INSERT OR UPDATE OF status, total, date, jornada_id, patient_id ON sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_sale_sync_transaction();

-- ---- Backfill: ventas completadas que hoy no tienen su ingreso registrado ----
INSERT INTO transactions (tenant_id, patient_id, appointment_id, sale_id, type, category, amount, description, date)
SELECT s.tenant_id, s.patient_id, s.appointment_id, s.id, 'income',
       CASE WHEN s.jornada_id IS NOT NULL THEN 'jornada' ELSE 'consultorio' END,
       s.total,
       COALESCE(NULLIF(s.notes, ''), 'Venta ' || COALESCE(s.payment_method, '')),
       COALESCE(s.date, CURRENT_DATE)
FROM sales s
WHERE s.status = 'completada'
  AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.sale_id = s.id)
ON CONFLICT (sale_id) DO NOTHING;

COMMENT ON FUNCTION public.tg_sale_sync_transaction IS
  'Mantiene en `transactions` el ingreso de cada venta completada (manual, Wompi o Bold), para que Finanzas refleje la realidad.';
