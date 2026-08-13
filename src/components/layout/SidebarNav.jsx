import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import { navParaRol } from './nav';

/**
 * SidebarNav — la navegación de escritorio y del cajón móvil.
 *
 * Dos formas del mismo componente:
 *  · `collapsed` (riel de 76px) para pantallas medianas o cuando el usuario
 *    quiere el máximo ancho útil para tablas y calendario.
 *  · expandido (264px) con etiquetas.
 *
 * El motivo vertebral (el riel con vértebras) es el hilo de la marca: aquí es
 * literalmente la columna de la navegación, y la vértebra activa se ilumina.
 */
export default function SidebarNav({ activeModule, onNavigate, collapsed = false, onToggleCollapse, alertCount = 0 }) {
  const { tenant, profile, signOut, membership } = useAuth();
  const initials = (profile?.full_name || 'U')
    .replace(/^(dr|dra)\.?\s+/i, '')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2);

  return (
    <div className="flex flex-col h-full pine-deep text-[#e9f0ec] pt-safe">
      {/* Marca */}
      <div className={cn('flex items-center gap-3 flex-shrink-0', collapsed ? 'px-4 pt-5 pb-4 justify-center' : 'px-5 pt-6 pb-5')}>
        <span className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
          <SpineMark />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <span className="font-display text-[17px] font-semibold tracking-tight block leading-none">
              chiropract<span className="text-tertiary-fixed-dim">.</span>co
            </span>
            <p className="text-[11px] text-[#a9c1b8] mt-1 truncate">{tenant?.name || 'Consultorio'}</p>
          </div>
        )}
      </div>

      {!collapsed && tenant?.plan && (
        <div className="px-5 pb-4 flex-shrink-0">
          <span className="inline-flex items-center gap-1.5 text-[10px] bg-white/10 text-tertiary-fixed px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
            Plan {tenant.plan}
          </span>
        </div>
      )}

      {/* Navegación con riel vertebral */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-3 pb-3 relative">
        <div
          className={cn(
            'absolute top-2 bottom-2 w-px bg-gradient-to-b from-tertiary-fixed-dim/45 via-white/12 to-transparent',
            collapsed ? 'left-1/2 -translate-x-1/2' : 'left-[25px]',
          )}
        />
        <ul className="space-y-0.5 relative">
          {navParaRol(membership?.role).map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group relative w-full flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-colors',
                    collapsed ? 'justify-center py-3 px-2' : 'pl-7 pr-3 py-2.5',
                    active ? 'text-white' : 'text-[#b6cdc4] hover:text-white hover:bg-white/5',
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active"
                      transition={{ type: 'spring', stiffness: 450, damping: 38 }}
                      className="absolute inset-0 rounded-xl bg-white/10 border border-white/10"
                    />
                  )}
                  {/* Vértebra */}
                  <span
                    className={cn(
                      'absolute w-2.5 h-2.5 rounded-full border-2 border-[#0a4238] transition-all duration-300',
                      collapsed ? 'left-1/2 -translate-x-1/2 -top-0.5 opacity-0' : 'left-[19px]',
                      active
                        ? 'bg-tertiary-fixed-dim scale-110 shadow-[0_0_0_4px_rgba(204,138,70,0.18)]'
                        : 'bg-[#2c5e51] group-hover:bg-[#3d7566]',
                    )}
                  />
                  <span className="relative flex items-center gap-3 min-w-0">
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className="flex-shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </span>
                  {!collapsed && item.accent && !active && (
                    <span className="relative ml-auto w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim/80" />
                  )}
                  {!collapsed && item.id === 'dashboard' && alertCount > 0 && (
                    <span className="relative ml-auto text-[10px] font-bold bg-tertiary-fixed-dim text-[#3a2410] rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center tnum">
                      {alertCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Pie: usuario + colapsar */}
      <div className={cn('border-t border-white/10 flex-shrink-0 pb-safe', collapsed ? 'p-2.5' : 'p-3.5')}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'flex-col gap-2')}>
          <div className="w-9 h-9 rounded-xl amber-gradient flex items-center justify-center text-[13px] font-bold text-[#3a2410] flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold truncate text-white">{profile?.full_name || 'Usuario'}</p>
                <p className="text-[11px] text-[#a9c1b8] truncate">{profile?.email || tenant?.name}</p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-[#8fb0a6] hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
                title="Cerrar sesión"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
          {collapsed && (
            <button onClick={signOut} className="p-1.5 rounded-lg text-[#8fb0a6] hover:text-white hover:bg-white/10" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          )}
        </div>

        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              'mt-2.5 w-full flex items-center gap-2 rounded-lg py-2 text-[11px] font-semibold uppercase tracking-wider',
              'text-[#8fb0a6] hover:text-white hover:bg-white/5 transition-colors',
              collapsed ? 'justify-center' : 'px-2.5',
            )}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronsRight size={15} /> : <><ChevronsLeft size={15} /> Colapsar</>}
          </button>
        )}
      </div>
    </div>
  );
}

/** Marca: tres vértebras apiladas. El logo del producto en 20px. */
function SpineMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v18" stroke="#cc8a46" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" />
      <ellipse cx="12" cy="6" rx="5" ry="2.1" stroke="#f0e2c9" strokeWidth="1.5" />
      <ellipse cx="12" cy="12" rx="6" ry="2.3" stroke="#f0e2c9" strokeWidth="1.5" />
      <ellipse cx="12" cy="18" rx="4.5" ry="2" stroke="#f0e2c9" strokeWidth="1.5" />
    </svg>
  );
}
