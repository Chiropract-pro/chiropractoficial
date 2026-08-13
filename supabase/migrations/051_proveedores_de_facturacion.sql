-- ============================================
-- 051_proveedores_de_facturacion.sql
--
-- La pantalla de facturación electrónica hablaba solo de Alegra: el texto, la
-- ayuda y hasta el nombre de los campos estaban escritos para ese proveedor,
-- aunque la columna `provider` ya existía. El consultorio que ya factura con
-- otro no tenía dónde decirlo.
--
-- Se abre la lista a los proveedores que se van a soportar. `qount` es el
-- servicio contable de Invent Agency; `factus` y `siigo` son los otros dos
-- comunes en Colombia. `manual` sigue siendo la salida para quien no emite
-- factura electrónica: las ventas se registran igual.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/051_proveedores_de_facturacion.sql
-- ============================================

ALTER TABLE public.tenant_billing_config
  DROP CONSTRAINT IF EXISTS tenant_billing_config_provider_check;

ALTER TABLE public.tenant_billing_config
  ADD CONSTRAINT tenant_billing_config_provider_check
  CHECK (provider = ANY (ARRAY['alegra', 'qount', 'siigo', 'factus', 'manual']));

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tenant_billing_config'::regclass
      AND conname  = 'tenant_billing_config_provider_check'
      AND pg_get_constraintdef(oid) LIKE '%qount%'
  ) THEN
    RAISE EXCEPTION 'La restricción de proveedor no quedó con qount';
  END IF;
END $$;
