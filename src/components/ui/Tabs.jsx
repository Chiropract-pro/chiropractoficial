import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

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
  return (
    <div className={cn('border-b border-outline-variant overflow-x-auto no-scrollbar', className)}>
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
  );
}
