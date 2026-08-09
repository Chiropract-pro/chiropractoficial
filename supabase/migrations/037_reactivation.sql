-- ============================================
-- 037_reactivation.sql
-- Radar de Reactivación — bitácora de contactos
--
-- POR QUÉ
-- El motor de reactivación prioriza a quién contactar hoy. Para que no vuelva
-- a proponer al mismo paciente cada mañana (y para que dos personas del equipo
-- no lo llamen el mismo día), cada contacto queda registrado aquí.
--
-- Es también la base de la métrica que sustenta el módulo: cuántos contactos
-- se hicieron, cuántos volvieron a agendar y cuánto dinero entró después.
--
-- Aplicar con:
--   supabase db query --linked -f supabase/migrations/037_reactivation.sql
--   (NO usar `db push`: el tracker remoto está vacío y reintentaría las 36
--    migraciones previas, que se aplicaron a mano.)
-- ============================================

CREATE TABLE IF NOT EXISTS reactivation_touches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Por dónde se contactó
  channel TEXT NOT NULL DEFAULT 'whatsapp'
    CHECK (channel IN ('whatsapp', 'llamada', 'email', 'cobro', 'presencial', 'otro')),

  -- Segmento por el que entró al radar cuando se hizo el contacto (histórico:
  -- el paciente puede cambiar de segmento después, el registro no).
  segment TEXT CHECK (segment IN ('saldo', 'abandono', 'dormido', 'primera')),

  -- Prioridad y valor estimado en el momento del contacto — permite medir
  -- después si el scoring acertó.
  score INT,
  estimated_value BIGINT,

  -- Resultado, si el equipo lo registra
  outcome TEXT CHECK (outcome IN ('sin_respuesta', 'agendo', 'pago', 'rechazo', 'numero_malo')),
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El acceso caliente es "último contacto por paciente"
CREATE INDEX IF NOT EXISTS idx_reactivation_touches_patient
  ON reactivation_touches(tenant_id, patient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reactivation_touches_tenant_date
  ON reactivation_touches(tenant_id, created_at DESC);

-- ============================================
-- RLS — solo miembros del tenant, igual que el resto del CRM
-- ============================================
ALTER TABLE reactivation_touches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactivation_touches_select" ON reactivation_touches;
CREATE POLICY "reactivation_touches_select"
  ON reactivation_touches FOR SELECT TO authenticated
  USING (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "reactivation_touches_insert" ON reactivation_touches;
CREATE POLICY "reactivation_touches_insert"
  ON reactivation_touches FOR INSERT TO authenticated
  WITH CHECK (public.is_tenant_member(tenant_id));

DROP POLICY IF EXISTS "reactivation_touches_update" ON reactivation_touches;
CREATE POLICY "reactivation_touches_update"
  ON reactivation_touches FOR UPDATE TO authenticated
  USING (public.is_tenant_member(tenant_id));

-- No se expone DELETE: la bitácora es histórico, no se edita borrando.

-- El autor se toma de la sesión, nunca del cliente.
CREATE OR REPLACE FUNCTION public.tg_reactivation_touch_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.user_id := COALESCE(NEW.user_id, auth.uid());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reactivation_touch_user ON reactivation_touches;
CREATE TRIGGER reactivation_touch_user
  BEFORE INSERT ON reactivation_touches
  FOR EACH ROW EXECUTE FUNCTION public.tg_reactivation_touch_user();
