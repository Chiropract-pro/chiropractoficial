-- ============================================
-- 055_categorias_de_finanzas.sql
--
-- EL FALLO (encontrado auditando antes de que el consultorio empiece a usarlo)
--   `transactions.category` solo aceptaba cinco valores del esquema original:
--     consultorio · jornada · marketing · operational · other
--   pero la pantalla de Finanzas ofrece otros once:
--     ingresos → consulta, seguimiento, jornada, producto, otro
--     gastos   → arriendo, servicios, insumos, nomina, mercadeo, transporte, otro
--   De los once, SOLO «jornada» pasaba la restricción.
--
--   Consecuencia real: registrar un gasto fallaba SIEMPRE, y registrar un
--   ingreso fallaba salvo que fuera de jornada. La función de gastos que se
--   agregó tras la reunión con el cliente nunca habría funcionado en producción.
--
--   Por qué no se vio antes: se probó en modo demostración, que no toca la base.
--   Una prueba que no cruza la frontera real no prueba nada.
--
-- LA CORRECCIÓN
--   Se abre la restricción al vocabulario que de verdad usa la pantalla, y se
--   conservan los cinco valores viejos: hay 8 filas históricas que los usan y
--   quitarlos las dejaría inválidas.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/055_categorias_de_finanzas.sql
-- ============================================

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_category_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_category_check
  CHECK (category = ANY (ARRAY[
    -- Ingresos, tal como los ofrece la pantalla
    'consulta', 'seguimiento', 'jornada', 'producto',
    -- Gastos
    'arriendo', 'servicios', 'insumos', 'nomina', 'mercadeo', 'transporte',
    -- Cajón de sastre
    'otro',
    -- Vocabulario del esquema original: lo usan filas que ya existen
    'consultorio', 'marketing', 'operational', 'other'
  ]));

-- ── Comprobación: los once valores de la pantalla tienen que pasar ─────────
DO $$
DECLARE
  v_t uuid;
  v_cat text;
  v_ok int := 0;
  cats text[] := ARRAY['consulta','seguimiento','jornada','producto','otro',
                       'arriendo','servicios','insumos','nomina','mercadeo','transporte'];
BEGIN
  SELECT id INTO v_t FROM public.tenants WHERE slug = 'dr-miguel-angel-diaz';

  FOREACH v_cat IN ARRAY cats LOOP
    BEGIN
      INSERT INTO public.transactions (tenant_id, type, amount, category, date, description)
      VALUES (v_t,
              CASE WHEN v_cat IN ('consulta','seguimiento','jornada','producto')
                   THEN 'income' ELSE 'expense' END,
              1, v_cat, CURRENT_DATE, 'COMPROBACION-055');
      v_ok := v_ok + 1;
    EXCEPTION WHEN check_violation THEN
      RAISE EXCEPTION 'La categoría «%» sigue sin ser aceptada', v_cat;
    END;
  END LOOP;

  -- Las filas de comprobación no se quedan.
  DELETE FROM public.transactions WHERE description = 'COMPROBACION-055';

  RAISE NOTICE 'Las % categorías de la pantalla pasan la restricción', v_ok;
END $$;
