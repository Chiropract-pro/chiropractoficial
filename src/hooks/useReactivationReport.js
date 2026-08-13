import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../lib/logger';
import { isDemoMode, DEMO_REACTIVACION } from '../lib/demo';

const DEMO = isDemoMode();

/**
 * Qué pasó con cada paciente al que se le escribió.
 *
 * El desenlace NO se guarda: lo calcula `reactivation_report` cruzando el
 * contacto con los mensajes y las citas posteriores. Guardarlo obligaría a
 * mantener un proceso que lo actualice, y ese proceso se cae — entonces la
 * pantalla diría «sin respuesta» de alguien que ya volvió al consultorio.
 */
export function useReactivationReport(days = 90) {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;
  const [rows, setRows] = useState(() => (DEMO ? DEMO_REACTIVACION : []));
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // `loading` se DERIVA en vez de guardarse en el caso vacío. Guardarlo obliga
  // a llamar setState dentro del efecto —lo que el compilador de React marca
  // como renders en cascada— y, peor, si no hay consultorio nadie apaga el
  // indicador y la pantalla se queda en «cargando» para siempre. Eso ya pasó
  // una vez en los hooks de datos.
  const loading = !DEMO && !!tenantId && cargando;

  const traer = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('reactivation_report', {
      p_tenant_id: tenantId,
      p_days: days,
    });
    if (err) {
      logger.error('reactivation_report', err);
      return { rows: [], error: err.code || 'report_failed' };
    }
    return { rows: data || [], error: null };
  }, [tenantId, days]);

  useEffect(() => {
    if (DEMO || !tenantId) return undefined;
    let cancelado = false;
    // Todo el setState va DESPUÉS del await: ahí ya no es un render en cascada.
    (async () => {
      const r = await traer();
      if (cancelado) return;
      setRows(r.rows);
      setError(r.error);
      setCargando(false);
    })();
    return () => { cancelado = true; };
  }, [traer, tenantId]);

  // Recarga a petición del usuario (un clic), no desde un efecto.
  const reload = useCallback(async () => {
    if (DEMO || !tenantId) return;
    setCargando(true);
    const r = await traer();
    setRows(r.rows);
    setError(r.error);
    setCargando(false);
  }, [traer, tenantId]);

  // Se cuenta sobre las filas ya traídas: el informe es corto (lo contactado en
  // los últimos 90 días), así que no vale la pena una segunda consulta.
  const resumen = rows.reduce((acc, r) => {
    acc.total += 1;
    if (r.outcome === 'volvio') { acc.volvieron += 1; acc.recuperado += Number(r.estimated_value) || 0; }
    else if (r.outcome === 'respondio') acc.respondieron += 1;
    else acc.sinRespuesta += 1;
    return acc;
  }, { total: 0, volvieron: 0, respondieron: 0, sinRespuesta: 0, recuperado: 0 });

  return { rows, resumen, loading, error, reload };
}
