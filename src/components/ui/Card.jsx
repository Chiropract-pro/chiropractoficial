import { cn } from '../../lib/utils';

/**
 * Card — superficie base editorial.
 * `pad` controla el padding, `tone` la piel (papel o pino), `interactive`
 * añade la elevación al hover para las tarjetas que son clicables.
 */
const TONES = {
  paper: 'bg-surface-container-lowest border-outline-variant',
  raised: 'bg-surface-container-lowest border-outline-variant shadow-clinical-lg',
  sunken: 'bg-surface-container-low border-outline-variant shadow-none',
  pine: 'pine-deep border-transparent text-on-primary shadow-pine',
};

export function Card({ className, children, pad = true, tone = 'paper', interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'border rounded-2xl',
        TONES[tone] || TONES.paper,
        tone !== 'sunken' && tone !== 'pine' && 'shadow-clinical',
        pad && 'p-4 sm:p-5',
        interactive && 'lift cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * SectionHeader — encabezado de panel con título display + acción opcional.
 */
export function SectionHeader({ title, hint, action, onAction, icon: Icon, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold text-on-surface flex items-center gap-2">
          {Icon && <Icon size={16} className="text-primary-light flex-shrink-0" />}
          <span className="truncate">{title}</span>
        </h3>
        {hint && <p className="text-xs text-on-surface-variant mt-0.5">{hint}</p>}
      </div>
      {action && (
        <button
          onClick={onAction}
          className="text-xs font-semibold text-primary hover:underline whitespace-nowrap flex-shrink-0 mt-1"
        >
          {action}
        </button>
      )}
    </div>
  );
}

/**
 * EmptyState — estado vacío consistente.
 */
export function EmptyState({ icon: Icon, title, hint, action, className }) {
  return (
    <div className={cn('text-center py-10 sm:py-12 px-4 text-on-surface-variant', className)}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-surface-container-low border border-outline-variant/60 flex items-center justify-center mx-auto mb-3">
          <Icon size={22} className="opacity-50" />
        </div>
      )}
      <p className="text-sm font-semibold text-on-surface">{title}</p>
      {hint && <p className="text-xs mt-1 max-w-xs mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/**
 * PageHeader — el encabezado editorial de cada módulo: kicker, título display
 * y acciones. En móvil las acciones bajan a una fila propia con scroll.
 */
export function PageHeader({ kicker, title, subtitle, children, className }) {
  return (
    <header className={cn('flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4', className)}>
      <div className="min-w-0">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="font-display text-title font-semibold text-on-surface mt-1">{title}</h1>
        {subtitle && <div className="text-on-surface-variant text-sm mt-1.5">{subtitle}</div>}
      </div>
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0 -mx-1 px-1 overflow-x-auto no-scrollbar">
          {children}
        </div>
      )}
    </header>
  );
}
