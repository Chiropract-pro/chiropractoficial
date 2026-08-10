-- ============================================
-- 042_sanear_cartera.sql
-- Pone la cartera en ceros para arrancar limpio, con respaldo
--
-- POR QUÉ
-- Los saldos de `patients.balance_due` vienen de la importación de la agenda
-- histórica: son las anotaciones "Debe" / "Saldo" que traía el archivo. Esa
-- plata ya se cobró en el consultorio, por fuera del sistema. Si se dejan,
-- el consultorio arranca viendo $4.107.035 de cartera que no existe, y el
-- Radar de Reactivación llama a 33 personas a cobrarles algo que ya pagaron.
--
-- Estado al momento de escribir esta migración (9-ago-2026, producción):
--   33 pacientes con saldo · total $4.107.035 · mínimo $35 · máximo $746.000
-- El mínimo de $35 delata lo que son estos datos: residuo de importación.
--
-- QUÉ HACE
--   1. Guarda TODOS los saldos actuales en `patient_balance_backup`.
--   2. Pone `balance_due = 0` en quienes tenían saldo.
-- No toca `total_spent` ni las transacciones: el histórico de lo facturado
-- se conserva intacto.
--
-- CÓMO REVERTIR (si alguno de esos saldos resulta ser real)
--   UPDATE patients p
--      SET balance_due = b.balance_due
--     FROM patient_balance_backup b
--    WHERE b.patient_id = p.id
--      AND b.snapshot = 'saneo-2026-08-09';
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/042_sanear_cartera.sql
-- ============================================

CREATE TABLE IF NOT EXISTS public.patient_balance_backup (
  id           BIGSERIAL PRIMARY KEY,
  snapshot     TEXT        NOT NULL,
  patient_id   UUID        NOT NULL,
  tenant_id    UUID,
  full_name    TEXT,
  balance_due  BIGINT      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS patient_balance_backup_unico
  ON public.patient_balance_backup (snapshot, patient_id);

COMMENT ON TABLE public.patient_balance_backup IS
  'Respaldo de saldos antes de un saneo de cartera. Solo service_role: contiene datos financieros de pacientes.';

-- Tabla de respaldo: sin políticas, así que ni anon ni authenticated la ven.
ALTER TABLE public.patient_balance_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.patient_balance_backup FROM PUBLIC, anon, authenticated;

-- 1) Respaldo. ON CONFLICT hace la migración repetible sin duplicar.
INSERT INTO public.patient_balance_backup (snapshot, patient_id, tenant_id, full_name, balance_due)
SELECT 'saneo-2026-08-09', p.id, p.tenant_id, p.full_name, p.balance_due
FROM public.patients p
WHERE COALESCE(p.balance_due, 0) > 0
ON CONFLICT (snapshot, patient_id) DO NOTHING;

-- 2) A cero.
UPDATE public.patients
SET balance_due = 0
WHERE COALESCE(balance_due, 0) > 0;

-- 3) Comprobación: no puede quedar cartera, y el respaldo tiene que cuadrar
--    con lo que había.
DO $$
DECLARE
  v_restantes INT;
  v_respaldados INT;
  v_total_respaldado BIGINT;
BEGIN
  SELECT count(*) INTO v_restantes
  FROM public.patients WHERE COALESCE(balance_due, 0) > 0;

  SELECT count(*), COALESCE(sum(balance_due), 0)
    INTO v_respaldados, v_total_respaldado
  FROM public.patient_balance_backup WHERE snapshot = 'saneo-2026-08-09';

  IF v_restantes > 0 THEN
    RAISE EXCEPTION 'Quedaron % pacientes con saldo', v_restantes;
  END IF;

  IF v_respaldados = 0 THEN
    RAISE EXCEPTION 'El respaldo quedó vacío: no se sanea nada sin poder revertir';
  END IF;

  RAISE NOTICE 'Cartera saneada. Respaldados % pacientes por un total de %.',
    v_respaldados, v_total_respaldado;
END $$;
