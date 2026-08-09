-- ============================================
-- 031_patient_history_import.sql
-- Adapta el esquema para recibir el HISTORICO digitalizado de las agendas
-- manuscritas del Dr. Diaz (2022-2025): ~1423 pacientes, ~3346 citas.
--
-- Todo idempotente. No borra nada. Los datos historicos se distinguen por
-- source='agenda_historica' y external_ref, para poder re-importar o revertir.
-- ============================================

-- ---- patients: idempotencia + metadata de import + deuda + alertas ----
ALTER TABLE patients ADD COLUMN IF NOT EXISTS external_ref  TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS source        TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS needs_review  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS balance_due   BIGINT  NOT NULL DEFAULT 0;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_alerts TEXT;

COMMENT ON COLUMN patients.external_ref   IS 'Clave estable del origen (p.ej. hist:tel:3XXXXXXXXX) para import idempotente.';
COMMENT ON COLUMN patients.balance_due    IS 'Saldo/deuda CONFIRMADO (la agenda dice Debe/Saldo). Los demas montos son tarifas/abonos, no deuda.';
COMMENT ON COLUMN patients.medical_alerts IS 'Alertas clinicas criticas agregadas del historial (diabetico, marcapasos, contraindicaciones, etc.).';

-- Un external_ref es unico por tenant (NULLS DISTINCT: no afecta filas ya existentes sin ref).
CREATE UNIQUE INDEX IF NOT EXISTS ux_patients_tenant_external_ref
  ON patients(tenant_id, external_ref);

-- ---- appointments: hora opcional + estado 'historica' + idempotencia ----
-- El historico manuscrito no siempre registra hora; poner 00:00 seria inventar.
ALTER TABLE appointments ALTER COLUMN time DROP NOT NULL;

-- Nuevo estado 'historica': cita digitalizada cuya asistencia NO esta verificada
-- (el "chulo" de la agenda es ambiguo; pendiente confirmar con el Dr.).
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD  CONSTRAINT appointments_status_check
  CHECK (status = ANY (ARRAY['pendiente','confirmada','cancelada','completada','no_asistio','historica']));

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS external_ref TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ux_appointments_tenant_external_ref
  ON appointments(tenant_id, external_ref);
