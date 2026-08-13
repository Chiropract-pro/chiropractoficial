-- ============================================
-- 049_tarifa_165_y_prueba_5_dias.sql
-- Dos correcciones acordadas con el cliente en la reunión de entrega
--
-- 1. LA TARIFA ES $165.000, NO $175.000
--    Ojo con la historia, porque se dio la vuelta: el prompt del bot traía
--    165.000 desde el principio. Se cambió a 175.000 por indicación de
--    Sebastian, y en la entrega el Dr. Miguel corrigió dos veces: «es que son
--    seis cinco» y, al cerrar, «tocó arreglarlos ahí porque está en 175.000».
--    Manda el cliente: vuelve a 165.000.
--
--    Se aplica a primera consulta, seguimiento y jornada. Urgencia se queda en
--    200.000, que nadie discutió.
--
-- 2. LA PRUEBA GRATUITA PASA DE 14 A 5 DÍAS
--    Acordado en la misma reunión: «ahí donde se empieza gratis 14 días se
--    cambia cinco días, cierto» → «sí, correcto». Cinco días bastan para que
--    un quiropráctico pruebe el sistema, y acortan la ventana entre el
--    registro y la decisión de pago.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/049_tarifa_165_y_prueba_5_dias.sql
-- ============================================

-- ── 1. Tarifas del consultorio ──────────────────────────────────────────────
UPDATE public.tenants
   SET appointment_prices = jsonb_build_object(
         'primera_consulta', 165000,
         'seguimiento',      165000,
         'jornada',          165000,
         'emergencia',       200000)
 WHERE slug = 'dr-miguel-angel-diaz';

-- Las jornadas ya creadas conservan su precio; solo cambia el de las nuevas.
ALTER TABLE public.jornadas
  ALTER COLUMN price_per_patient SET DEFAULT 165000;

-- ── 2. Prueba gratuita de 5 días ───────────────────────────────────────────
ALTER TABLE public.tenants
  ALTER COLUMN trial_ends_at SET DEFAULT (NOW() + INTERVAL '5 days');

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_precio TEXT;
  v_default TEXT;
BEGIN
  SELECT appointment_prices ->> 'primera_consulta' INTO v_precio
  FROM tenants WHERE slug = 'dr-miguel-angel-diaz';

  IF v_precio <> '165000' THEN
    RAISE EXCEPTION 'La tarifa quedó en % y debía ser 165000', v_precio;
  END IF;

  SELECT column_default INTO v_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'trial_ends_at';

  IF v_default NOT LIKE '%5 days%' THEN
    RAISE EXCEPTION 'La prueba gratuita no quedó en 5 días: %', v_default;
  END IF;
END $$;
