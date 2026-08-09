import { cn } from '../../lib/utils';

/**
 * Field — etiqueta + control + ayuda, con el mismo ritmo en toda la app.
 * Antes cada formulario repetía la misma cadena de 9 clases de Tailwind a mano
 * y ninguna coincidía del todo con la siguiente.
 */
export function Field({ label, hint, error, required, className, children, span }) {
  return (
    <div className={cn('min-w-0', span === 2 && 'sm:col-span-2', className)}>
      {label && (
        <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error
        ? <p className="text-[11px] text-danger mt-1">{error}</p>
        : hint && <p className="text-[11px] text-on-surface-variant/80 mt-1">{hint}</p>}
    </div>
  );
}

const CONTROL = 'w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3.5 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/50 transition-[border-color,box-shadow] focus:outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/12 disabled:bg-surface-container-low disabled:text-on-surface-variant disabled:cursor-not-allowed';

export function Input({ className, ...props }) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn(CONTROL, 'resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        CONTROL,
        // La flecha nativa se ve distinta en cada SO; se dibuja una propia.
        'appearance-none bg-no-repeat pr-9',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%235f6a63' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: 'right 0.75rem center',
      }}
      {...props}
    >
      {children}
    </select>
  );
}

/** Rejilla de formulario: una columna en móvil, dos desde `sm`. */
export function FormGrid({ className, children }) {
  return <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>{children}</div>;
}
