import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Modal — diálogo en escritorio, hoja inferior (bottom sheet) en móvil.
 *
 * POR QUÉ EXISTE
 * Cada módulo tenía su propio `fixed inset-0 ... items-center` copiado a mano:
 * en un teléfono el formulario quedaba centrado, sin margen para el pulgar y
 * con el teclado tapando la mitad. Aquí el mismo componente es hoja abajo en
 * móvil (donde llega el pulgar) y diálogo centrado desde `sm`.
 *
 * Además centraliza lo que nadie tenía: cierre con Escape, bloqueo del scroll
 * de fondo, foco inicial dentro del diálogo y `aria-modal`.
 */
const SIZES = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-4xl',
};

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  footer,
  children,
  className,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Foco al panel para que el lector de pantalla y el teclado entren al diálogo
    const t = setTimeout(() => panelRef.current?.focus(), 40);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      {/* Sin AnimatePresence ni animación de salida, a propósito.
          AnimatePresence retiene el nodo hasta que termina la animación de
          cierre; si el navegador tiene las animaciones pausadas (pestaña en
          segundo plano), esa animación nunca acaba y EL DIÁLOGO NO SE PUEDE
          CERRAR: ni con Escape, ni con la X, ni tocando fuera. Cerrar tiene
          que ser inmediato y seguro.
          Por lo mismo el velo y el panel nacen ya visibles: solo se anima el
          desplazamiento de entrada tampoco: con las animaciones pausadas, la
          hoja se quedaba 18px por debajo del borde y los botones del pie
          caían fuera de la pantalla. Aparece directo, siempre completa. */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#0b120f]/45 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative w-full sm:w-full bg-surface-container-lowest shadow-clinical-lg outline-none',
              'rounded-t-3xl sm:rounded-2xl border border-outline-variant',
              'max-h-[92dvh] sm:max-h-[88dvh] flex flex-col',
              SIZES[size],
              className,
            )}
          >
            {/* Asa de la hoja — solo móvil */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center flex-shrink-0">
              <span className="w-10 h-1 rounded-full bg-outline-variant" />
            </div>

            {(title || onClose) && (
              <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-4 flex-shrink-0">
                <div className="min-w-0">
                  {title && <h3 className="font-display text-lg font-semibold text-on-surface truncate">{title}</h3>}
                  {subtitle && <p className="text-xs text-on-surface-variant mt-0.5">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="-mr-1 -mt-1 p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors flex-shrink-0"
                >
                  <X size={18} />
                </button>
              </header>
            )}

            <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 flex-1">
              {children}
            </div>

            <footer
              className={cn(
                'px-5 sm:px-6 pt-4 pb-5 sm:pb-6 flex-shrink-0 pb-safe',
                footer && 'border-t border-outline-variant mt-2',
              )}
            >
              {footer}
            </footer>
      </div>
    </div>,
    document.body,
  );
}
