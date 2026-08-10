-- ============================================
-- 041_tenant_pricing.sql
-- Las tarifas dejan de estar quemadas en el código
--
-- PROBLEMA
-- Los precios de las citas vivían en `src/utils/format.js` como constantes:
--
--   { value: 'primera_consulta', label: 'Primera consulta', price: 150000 },
--   { value: 'seguimiento',      label: 'Seguimiento',      price: 100000 },
--
-- Cambiar una tarifa exigía editar código, compilar y desplegar. Para un
-- consultorio que sube precios una vez al año eso significa depender del
-- desarrollador para algo que es puramente suyo — y mientras tanto el sistema
-- cobra mal.
--
-- SOLUCIÓN
-- Una columna JSONB por consultorio con las tarifas que ese consultorio cobra.
-- El código conserva sus valores por defecto: si la columna está vacía o le
-- falta un tipo de cita, se usa el valor de fábrica. Así ningún consultorio
-- existente se queda sin precios por no haber configurado nada.
--
-- Forma del objeto (todas las claves opcionales, montos en pesos enteros):
--   { "primera_consulta": 175000, "seguimiento": 175000,
--     "jornada": 175000, "emergencia": 200000 }
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/041_tenant_pricing.sql
-- ============================================

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS appointment_prices JSONB;

COMMENT ON COLUMN public.tenants.appointment_prices IS
  'Tarifas por tipo de cita, en pesos. Las claves que falten usan el valor por defecto del código. Se edita desde Ajustes → Tarifas.';

-- Restricción de cordura: si viene algo, tiene que ser un objeto JSON.
-- Un array o un número aquí romperían la lectura en el cliente.
ALTER TABLE public.tenants
  DROP CONSTRAINT IF EXISTS tenants_appointment_prices_is_object;

ALTER TABLE public.tenants
  ADD CONSTRAINT tenants_appointment_prices_is_object
  CHECK (appointment_prices IS NULL OR jsonb_typeof(appointment_prices) = 'object');

-- Comprobación.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenants'
      AND column_name = 'appointment_prices'
  ) THEN
    RAISE EXCEPTION 'No se creó tenants.appointment_prices';
  END IF;
END $$;
