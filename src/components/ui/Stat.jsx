import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Primitivas de dato: la fila de indicadores, el sparkline y el anillo de meta.
 * Todo dibujado en SVG propio — sin librería de charts, sin peso extra y con
 * los mismos tokens de color que el resto de la piel.
 */

/**
 * StatGrid — la fila de KPIs. Tarjetas unidas por hairlines, no separadas.
 *
 * Las líneas no son bordes de cada celda sino el fondo del grid asomando por
 * un gap de 1px: así funcionan con cualquier número de columnas y de filas.
 * Con bordes por `nth-child` (la versión anterior), tres métricas en dos
 * columnas dejaban una celda hueca y las líneas no cerraban.
 */
export function StatGrid({ children, cols = 4, className }) {
  return (
    <div
      className={cn(
        'grid gap-px bg-outline-variant border border-outline-variant rounded-2xl overflow-hidden shadow-clinical',
        cols === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Stat — un indicador. `series` dibuja el sparkline de fondo; `delta` el
 * cambio contra el periodo anterior (verde arriba / rojo abajo).
 */
export function Stat({
  label,
  value,
  sub,
  icon: Icon,
  delta,
  series,
  tone = 'default',
  onClick,
  className,
}) {
  const up = typeof delta === 'number' && delta >= 0;
  const Tag = onClick ? 'button' : 'div';

  return (
    <Tag
      onClick={onClick}
      className={cn(
        'group relative p-4 sm:p-5 text-left overflow-hidden bg-surface-container-lowest',
        onClick && 'transition-colors hover:bg-surface-container-low/70 cursor-pointer',
        className,
      )}
    >
      {series?.length > 1 && (
        <Sparkline
          data={series}
          className="absolute inset-x-0 bottom-0 h-10 opacity-[0.16] group-hover:opacity-30 transition-opacity pointer-events-none"
          tone={tone}
        />
      )}
      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-on-surface-variant min-w-0">
          {Icon && <Icon size={13} className="text-primary-light flex-shrink-0" />}
          <span className="truncate">{label}</span>
        </span>
        {typeof delta === 'number' && (
          <span
            className={cn(
              'flex items-center gap-0.5 text-[11px] font-bold tnum flex-shrink-0',
              up ? 'text-success' : 'text-danger',
            )}
          >
            {up ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p
        className={cn(
          'relative font-display text-metric font-semibold mt-2 tnum',
          tone === 'accent' ? 'text-primary' : tone === 'danger' ? 'text-danger' : 'text-on-surface',
        )}
      >
        {value}
      </p>
      {sub && <p className="relative text-[11px] text-on-surface-variant/85 mt-1.5 truncate">{sub}</p>}
    </Tag>
  );
}

const SPARK_STROKE = { default: '#0c4a3e', accent: '#0c4a3e', danger: '#c25b46', amber: '#cc8a46' };

/**
 * Sparkline — tendencia sin ejes. Se usa de fondo en los KPIs y en línea
 * dentro de las tarjetas de detalle.
 */
export function Sparkline({ data = [], className, tone = 'default', strokeWidth = 2 }) {
  if (!data || data.length < 2) return null;
  const W = 100;
  const H = 28;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - ((v - min) / range) * (H - 4) - 2]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${W},${H} L0,${H} Z`;
  const color = SPARK_STROKE[tone] || SPARK_STROKE.default;
  const gid = `spark-${tone}-${data.length}-${Math.round(max)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn('w-full', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * ProgressRing — la meta del mes como anillo. Se lee de un vistazo mucho
 * mejor que una barra, y en móvil ocupa la mitad del ancho.
 */
export function ProgressRing({ percent = 0, size = 132, stroke = 11, label, sublabel, tone }) {
  const clamped = Math.max(0, Math.min(percent, 100));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = tone || (clamped >= 100 ? '#2c7a5e' : clamped >= 60 ? '#0c4a3e' : '#cc8a46');

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-surface-container-high)" strokeWidth={stroke} />
        {/* El arco se dibuja ya en su valor: si el navegador pausa las
            animaciones (pestaña en segundo plano), el dato sigue visible.
            La transición CSS lo anima cuando el porcentaje cambia. */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (clamped / 100) * c}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3">
        <span className="font-display text-2xl font-semibold text-on-surface tnum leading-none">{label ?? `${Math.round(clamped)}%`}</span>
        {sublabel && <span className="text-[10px] text-on-surface-variant mt-1 leading-tight">{sublabel}</span>}
      </div>
    </div>
  );
}
