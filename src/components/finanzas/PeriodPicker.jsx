import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { todayStr } from '../../utils/dates';
import { formatShortDate } from '../../utils/format';

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

/**
 * Selector de periodo contable.
 *
 * Antes Finanzas estaba clavado al mes en curso: no había forma de cerrar un
 * mes anterior ni de mirar un rango propio, que es justo lo que se necesita
 * para llevar la contabilidad mes a mes.
 */
export default function PeriodPicker({ period, onChange, className = '' }) {
  const presets = buildPeriodPresets();
  const [custom, setCustom] = useState(false);

  const isActive = (p) => period.from === p.from && period.to === p.to;
  const customActive = custom || !presets.some(isActive);

  const setCustomEdge = (edge, value) => {
    if (!value) return;
    // Si el usuario invierte el rango, se corrige en vez de mostrar cero pesos
    // sin explicación.
    const next = { ...period, [edge]: value };
    if (next.from > next.to) {
      if (edge === 'from') next.to = value;
      else next.from = value;
    }
    onChange(next);
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none">
        <CalendarRange size={15} className="text-on-surface-variant flex-shrink-0" aria-hidden="true" />
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setCustom(false); onChange({ from: p.from, to: p.to }); }}
            aria-pressed={!customActive && isActive(p)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors border ${
              !customActive && isActive(p)
                ? 'bg-primary text-on-primary border-primary'
                : 'bg-surface-container-low text-on-surface-variant border-outline-variant/70 hover:text-on-surface hover:border-outline-variant'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCustom(true)}
          aria-pressed={customActive}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[12.5px] font-medium transition-colors border ${
            customActive
              ? 'bg-primary text-on-primary border-primary'
              : 'bg-surface-container-low text-on-surface-variant border-outline-variant/70 hover:text-on-surface hover:border-outline-variant'
          }`}
        >
          Personalizado
        </button>
      </div>

      {customActive && (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Desde</span>
            <input
              type="date"
              value={period.from}
              max={period.to}
              onChange={(e) => setCustomEdge('from', e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">Hasta</span>
            <input
              type="date"
              value={period.to}
              min={period.from}
              onChange={(e) => setCustomEdge('to', e.target.value)}
              className="bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-[13px] text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      )}
    </div>
  );
}
