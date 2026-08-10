/**
 * Periodos contables para Finanzas.
 *
 * Vive fuera del componente para que el archivo del selector exporte solo
 * el componente (regla react-refresh) y para que Finanzas pueda calcular el
 * periodo inicial sin importar interfaz.
 */
import { todayStr } from './dates';
import { formatShortDate } from './format';

const pad = (n) => String(n).padStart(2, '0');
const firstOf = (y, m) => `${y}-${pad(m)}-01`;
/** Último día del mes. `new Date(y, m, 0)` retrocede un día desde el 1º del mes
 *  siguiente; solo se lee el número de día, así que no hay riesgo de zona horaria. */
const lastOf = (y, m) => `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}`;

/**
 * Rangos predefinidos, calculados desde "hoy" según la zona del consultorio.
 * Devuelve siempre fechas en formato YYYY-MM-DD, que es como se guardan las
 * transacciones — así el filtrado es comparación de cadenas, sin conversiones.
 */
export function buildPeriodPresets(today = todayStr()) {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;

  // Trimestre = el mes en curso y los dos anteriores, completos.
  const q = new Date(y, m - 3, 1);
  const qy = q.getFullYear();
  const qm = q.getMonth() + 1;

  return [
    { id: 'hoy', label: 'Hoy', from: today, to: today },
    { id: 'mes', label: 'Este mes', from: firstOf(y, m), to: lastOf(y, m) },
    { id: 'mes_pasado', label: 'Mes pasado', from: firstOf(prevY, prevM), to: lastOf(prevY, prevM) },
    { id: 'trimestre', label: '3 meses', from: firstOf(qy, qm), to: lastOf(y, m) },
    { id: 'anio', label: 'Este año', from: `${y}-01-01`, to: `${y}-12-31` },
  ];
}

/**
 * Etiqueta corta del rango. Va dentro de tarjetas estrechas, así que un
 * "Sábado, 1 de agosto de 2026 — Lunes, 31 de agosto de 2026" se desborda:
 * los rangos que coinciden con un mes o un año se nombran por su nombre.
 */
export function periodLabel(period) {
  const { from, to } = period || {};
  if (!from || !to) return 'Todo el histórico';
  if (from === to) return formatShortDate(from);

  const [fy, fm] = [from.slice(0, 4), Number(from.slice(5, 7))];
  const [ty, tm] = [to.slice(0, 4), Number(to.slice(5, 7))];
  const isMonthStart = from.endsWith('-01');
  const isMonthEnd = to === lastOf(Number(ty), tm);

  if (isMonthStart && isMonthEnd) {
    const nameOf = (y, mo) => new Date(Number(y), mo - 1, 1)
      .toLocaleDateString('es-CO', { month: 'long' });
    const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    // Año completo.
    if (fy === ty && fm === 1 && tm === 12) return fy;
    // Un solo mes.
    if (fy === ty && fm === tm) return `${cap(nameOf(fy, fm))} ${fy}`;
    // Varios meses seguidos.
    return `${cap(nameOf(fy, fm))} — ${cap(nameOf(ty, tm))} ${ty}`;
  }

  return `${formatShortDate(from)} — ${formatShortDate(to)}`;
}
