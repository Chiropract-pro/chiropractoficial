-- ============================================
-- 050_licencia_propia_sin_limites.sql
--
-- EL PROBLEMA QUE ESTO ARREGLA (verificado en producción, 12-ago-2026)
--   El consultorio del Dr. Miguel Ángel Díaz NO PODÍA REGISTRAR UN PACIENTE
--   NUEVO. Estaba en el plan «pro», que tope en 1.000 pacientes, y ya tiene
--   1.427. `tenant_check_plan_limit` devolvía:
--       {"can_add": false, "current": 1427, "max": 1000, "plan_id": "pro"}
--   así que cada intento moría con «Tu plan pro permite 1000 pacientes».
--
--   Además la pantalla de Plan le anunciaba una renovación para el 15-jul-2027
--   y le ofrecía «Cancelar suscripción». Nada de eso aplica: él no paga una
--   mensualidad, compró el sistema.
--
-- LA SOLUCIÓN
--   Un plan «propio»: sin tope de pacientes ni de usuarios, sin mensualidad y
--   sin fecha de renovación. No se ofrece en la página de precios (is_public
--   = false) porque no es un plan que alguien contrate: es una licencia.
--
--   `tenant_check_plan_limit` ya trata NULL como ilimitado
--   (`v_max IS NULL OR v_current < v_max`), así que no hay que tocarla.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/050_licencia_propia_sin_limites.sql
-- ============================================

-- ── 1. Una licencia perpetua no tiene fin de periodo ────────────────────────
-- La columna era NOT NULL, lo que obligaba a inventar una fecha futura y a
-- mostrar «faltan 27.000 días». NULL dice la verdad: no vence.
ALTER TABLE public.tenant_subscriptions
  ALTER COLUMN current_period_end DROP NOT NULL;

-- ── 2. El plan ──────────────────────────────────────────────────────────────
INSERT INTO public.plans
  (id, name, tagline, price_cop_monthly, price_cop_yearly,
   max_patients, max_users, max_storage_mb, features, is_public, display_order, badge)
VALUES
  ('propio', 'Licencia propia', 'Sistema adquirido, sin mensualidad',
   0, 0,
   NULL, NULL, NULL,
   '["Pacientes ilimitados","Usuarios ilimitados","Sin renovación","Todas las funciones"]'::jsonb,
   FALSE, 99, 'Propiedad del consultorio')
ON CONFLICT (id) DO UPDATE
  SET name            = EXCLUDED.name,
      tagline         = EXCLUDED.tagline,
      max_patients    = NULL,
      max_users       = NULL,
      max_storage_mb  = NULL,
      price_cop_monthly = 0,
      price_cop_yearly  = 0,
      is_public       = FALSE,
      features        = EXCLUDED.features,
      badge           = EXCLUDED.badge;

-- ── 3. La vista entiende «sin vencimiento» ─────────────────────────────────
-- `days_remaining` quedaba en NULL solo; el problema era el desempate: con
-- `ORDER BY current_period_end DESC` y varias filas, Postgres pone los NULL
-- primero, que es lo que queremos (la licencia perpetua gana), pero se deja
-- explícito para que no dependa del comportamiento por defecto.
CREATE OR REPLACE VIEW public.tenant_current_subscription AS
SELECT s.id AS subscription_id,
       s.tenant_id,
       s.plan_id,
       s.status,
       s.billing_cycle,
       s.current_period_start,
       s.current_period_end,
       s.cancel_at_period_end,
       CASE
         WHEN s.current_period_end IS NULL THEN NULL   -- no vence
         ELSE GREATEST(0::bigint, EXTRACT(epoch FROM s.current_period_end - now())::bigint / 86400)
       END AS days_remaining,
       p.name AS plan_name,
       p.tagline AS plan_tagline,
       p.price_cop_monthly,
       p.price_cop_yearly,
       p.max_patients,
       p.max_users,
       p.max_storage_mb,
       p.features
FROM tenant_subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.id = (
  SELECT s2.id FROM tenant_subscriptions s2
  WHERE s2.tenant_id = s.tenant_id
  ORDER BY s2.current_period_end DESC NULLS FIRST
  LIMIT 1
);

-- ── 4. El consultorio del Dr. Miguel pasa a licencia propia ────────────────
UPDATE public.tenant_subscriptions
   SET plan_id              = 'propio',
       status               = 'active',
       current_period_end   = NULL,
       cancel_at_period_end = FALSE,
       cancelled_at         = NULL,
       updated_at           = NOW()
 WHERE tenant_id = (SELECT id FROM public.tenants WHERE slug = 'dr-miguel-angel-diaz');

-- ── Comprobación ────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_tenant uuid;
  v_plan text;
  v_max int;
  v_fin timestamptz;
  v_pacientes int;
BEGIN
  SELECT id INTO v_tenant FROM public.tenants WHERE slug = 'dr-miguel-angel-diaz';

  SELECT plan_id, max_patients, current_period_end
    INTO v_plan, v_max, v_fin
  FROM public.tenant_current_subscription WHERE tenant_id = v_tenant;

  SELECT count(*) INTO v_pacientes FROM public.patients WHERE tenant_id = v_tenant;

  IF v_plan <> 'propio' THEN
    RAISE EXCEPTION 'El plan quedó en % y debía ser propio', v_plan;
  END IF;
  IF v_max IS NOT NULL THEN
    RAISE EXCEPTION 'El tope de pacientes quedó en % y debía ser ilimitado', v_max;
  END IF;
  IF v_fin IS NOT NULL THEN
    RAISE EXCEPTION 'La licencia quedó venciendo el % y no debía vencer', v_fin;
  END IF;

  RAISE NOTICE 'Licencia propia activa · % pacientes, sin tope, sin renovación', v_pacientes;
END $$;
