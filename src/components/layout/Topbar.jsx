import { Bell, Menu, Search } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NAV_BY_ID } from './nav';
import { parseDateStr, todayStr } from '../../utils/dates';

const LONG_DATE = { weekday: 'long', day: 'numeric', month: 'long' };

/**
 * Topbar — barra superior pegajosa. Es la única superficie que cambia de forma
 * entre móvil y escritorio: en el teléfono lleva el botón del cajón y el título
 * del módulo; en escritorio, el buscador global y la fecha del consultorio.
 */
export default function Topbar({ activeModule, onOpenDrawer, onOpenSearch, alertCount = 0, onAlertsClick }) {
  const item = NAV_BY_ID[activeModule];
  const today = parseDateStr(todayStr()).toLocaleDateString('es-CO', LONG_DATE);

  return (
    <header className="sticky top-0 z-30 glass-nav pt-safe">
      <div className="flex items-center gap-3 h-14 lg:h-16 px-4 sm:px-6 lg:px-8">
        <button
          onClick={onOpenDrawer}
          className="lg:hidden -ml-2 p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Abrir menú"
        >
          <Menu size={20} />
        </button>

        <div className="min-w-0 flex-1 lg:flex-none">
          <h2 className="font-display text-[15px] lg:text-base font-semibold text-on-surface truncate leading-tight">
            {item?.label || 'Panel'}
          </h2>
          {/* first-letter, no `capitalize`: es-CO devuelve "sábado, 8 de agosto"
              y `capitalize` lo convertía en "Sábado, 8 De Agosto". */}
          <p className="hidden lg:block text-[11px] text-on-surface-variant first-letter:uppercase">{today}</p>
        </div>

        {/* Buscador — barra completa en escritorio, botón icono en móvil */}
        <button
          onClick={onOpenSearch}
          className={cn(
            'hidden lg:flex items-center gap-2.5 ml-auto w-full max-w-sm px-3.5 py-2 rounded-xl',
            'bg-surface-container-lowest border border-outline-variant text-on-surface-variant',
            'hover:border-outline transition-colors text-left',
          )}
        >
          <Search size={15} className="flex-shrink-0" />
          <span className="text-[13px] flex-1 truncate">Buscar paciente o ir a…</span>
          <kbd className="text-[10px] font-sans font-semibold px-1.5 py-0.5 rounded border border-outline-variant bg-surface-container text-on-surface-variant/80">
            ⌘K
          </kbd>
        </button>

        <button
          onClick={onOpenSearch}
          className="lg:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
          aria-label="Buscar"
        >
          <Search size={19} />
        </button>

        <button
          onClick={onAlertsClick}
          className="relative p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors lg:ml-1"
          aria-label={alertCount > 0 ? `${alertCount} alertas` : 'Alertas'}
        >
          <Bell size={19} />
          {alertCount > 0 && (
            <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center tnum">
              {alertCount > 9 ? '9+' : alertCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
