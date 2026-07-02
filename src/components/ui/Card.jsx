import { cn } from '../../lib/utils';

/**
 * Card — superficie base editorial. `pad` controla el padding, `as` el tag.
 */
export function Card({ className, children, pad = true, ...props }) {
  return (
    <div
      className={cn(
        'bg-surface-container-lowest border border-outline-variant rounded-2xl shadow-clinical',
        pad && 'p-5',
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
export function SectionHeader({ title, action, onAction, className }) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)}>
      <h3 className="font-display text-lg font-semibold text-on-surface">{title}</h3>
      {action && (
        <button onClick={onAction} className="text-xs font-semibold text-primary hover:underline">
          {action}
        </button>
      )}
    </div>
  );
}

/**
 * EmptyState — estado vacío consistente.
 */
export function EmptyState({ icon: Icon, title, hint, className }) {
  return (
    <div className={cn('text-center py-12 text-on-surface-variant', className)}>
      {Icon && <Icon size={30} className="mx-auto mb-3 opacity-40" />}
      <p className="text-sm font-medium text-on-surface">{title}</p>
      {hint && <p className="text-xs mt-1">{hint}</p>}
    </div>
  );
}
