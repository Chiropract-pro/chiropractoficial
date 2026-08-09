import { motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NAV_ITEMS } from './nav';

/**
 * MobileNav — barra inferior nativa para el teléfono.
 *
 * POR QUÉ
 * La única navegación en móvil era un botón flotante que tapaba el título de
 * la pantalla y abría un cajón. Cada cambio de módulo costaba dos toques y una
 * animación. Aquí los cuatro destinos que el consultorio usa a diario están a
 * un toque, en la zona del pulgar, y el resto vive tras "Más".
 */
export default function MobileNav({ activeModule, onNavigate, onOpenDrawer }) {
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const inMore = !primary.some((i) => i.id === activeModule);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 glass-nav border-t border-outline-variant pb-safe">
      <div className="grid grid-cols-5 h-16">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center gap-1 pt-1"
            >
              {active && (
                <motion.span
                  layoutId="mobile-nav-active"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  className="absolute top-0 w-9 h-[3px] rounded-b-full bg-primary"
                />
              )}
              <Icon
                size={21}
                strokeWidth={active ? 2.2 : 1.7}
                className={cn('transition-colors', active ? 'text-primary' : 'text-on-surface-variant')}
              />
              <span
                className={cn(
                  'text-[10px] font-semibold transition-colors',
                  active ? 'text-primary' : 'text-on-surface-variant',
                )}
              >
                {item.short}
              </span>
            </button>
          );
        })}

        <button onClick={onOpenDrawer} className="relative flex flex-col items-center justify-center gap-1 pt-1">
          {inMore && (
            <motion.span
              layoutId="mobile-nav-active"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
              className="absolute top-0 w-9 h-[3px] rounded-b-full bg-primary"
            />
          )}
          <MoreHorizontal
            size={21}
            strokeWidth={inMore ? 2.2 : 1.7}
            className={cn('transition-colors', inMore ? 'text-primary' : 'text-on-surface-variant')}
          />
          <span className={cn('text-[10px] font-semibold', inMore ? 'text-primary' : 'text-on-surface-variant')}>
            Más
          </span>
        </button>
      </div>
    </nav>
  );
}
