import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Avisa si una barra de pestañas tiene contenido escondido a los lados.
 *
 * El scroll horizontal existía, pero con la barra oculta (`no-scrollbar`) no
 * había NINGUNA pista de que hubiera más: en Ajustes, la pestaña «Plan»
 * quedaba fuera de pantalla y era, en la práctica, inalcanzable. Con esto se
 * dibuja un degradado en el borde por donde sigue habiendo pestañas.
 */
function useBordesConMas(ref, dependencia) {
  const [bordes, setBordes] = useState({ izq: false, der: false });

  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setBordes({
      izq: el.scrollLeft > 4,
      der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, [ref]);

  useEffect(() => {
    medir();
    const el = ref.current;
    el?.addEventListener('scroll', medir, { passive: true });
    window.addEventListener('resize', medir);
    return () => {
      el?.removeEventListener('scroll', medir);
      window.removeEventListener('resize', medir);
    };
  }, [medir, ref, dependencia]);

  return bordes;
}

/**
 * Botón para llegar a las pestañas que quedaron fuera de pantalla.
 *
 * Un degradado solo no basta: se dibuja sobre el espacio vacío del final de la
 * fila y no se ve. Aquí hay algo en qué hacer clic, que es lo que faltaba para
 * poder llegar a «Plan» sin saber que la barra se arrastra.
 */
function IrAMasPestanas({ lado, visible, scroller }) {
  if (!visible) return null;
  const derecha = lado === 'der';
  const Flecha = derecha ? ChevronRight : ChevronLeft;

  return (
    <div
      className={cn(
        'absolute top-0 bottom-px z-10 flex items-center pl-6 pr-0.5',
        derecha
          ? 'right-0 bg-gradient-to-l from-background from-60% to-transparent'
          : 'left-0 flex-row-reverse pr-6 pl-0.5 bg-gradient-to-r from-background from-60% to-transparent',
      )}
    >
      <button
        type="button"
        aria-label={derecha ? 'Ver más pestañas' : 'Ver pestañas anteriores'}
        onClick={() => scroller.current?.scrollBy({ left: derecha ? 180 : -180, behavior: 'smooth' })}
        className="w-6 h-6 rounded-full bg-surface-container-high text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest flex items-center justify-center shadow-sm transition-colors"
      >
        <Flecha size={14} />
      </button>
    </div>
  );
}

/**
 * SegmentedTabs — control segmentado con indicador que se desliza.
 * Scrollea en horizontal cuando no caben (en un teléfono de 360px, seis
 * pestañas se salían de la pantalla y no había forma de llegar a la última).
 */
export function SegmentedTabs({ tabs, value, onChange, className, layoutId = 'seg' }) {
  return (
    <div className={cn('-mx-1 px-1 overflow-x-auto no-scrollbar', className)}>
      <div
        role="tablist"
        className="inline-flex gap-1 p-1 rounded-2xl bg-surface-container-high/70 border border-outline-variant/60 min-w-max"
      >
        {tabs.map((tab) => {
          const active = value === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-colors',
                active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {active && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-0 rounded-xl bg-surface-container-lowest shadow-clinical"
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {Icon && <Icon size={14} />}
                {tab.label}
                {tab.count != null && (
                  <span
                    className={cn(
                      'ml-0.5 text-[10px] font-bold px-1.5 py-px rounded-full tnum',
                      active ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant',
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * UnderlineTabs — pestañas de sección (Ajustes, ficha de paciente).
 * Scroll horizontal en móvil, con sangrado a los bordes para que se note
 * que hay más contenido.
 */
export function UnderlineTabs({ tabs, value, onChange, className }) {
  const scroller = useRef(null);
  const bordes = useBordesConMas(scroller, tabs.length);

  return (
    <div className={cn('relative border-b border-outline-variant', className)}>
      <IrAMasPestanas lado="izq" visible={bordes.izq} scroller={scroller} />
      <IrAMasPestanas lado="der" visible={bordes.der} scroller={scroller} />
      <div ref={scroller} className="overflow-x-auto no-scrollbar">
        <div role="tablist" className="flex gap-1 min-w-max">
        {tabs.map((tab) => {
          const active = value === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex items-center gap-2 px-3.5 py-3 text-sm font-semibold whitespace-nowrap transition-colors',
                active ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {Icon && <Icon size={15} />}
              {tab.label}
              {active && (
                <motion.span
                  layoutId="underline-tab"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
