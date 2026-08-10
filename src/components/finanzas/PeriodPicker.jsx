import { useState } from 'react';
import { CalendarRange } from 'lucide-react';
import { buildPeriodPresets } from '../../utils/period';

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
