import { LayoutDashboard, Users, Calendar, Car, Package, DollarSign, Bell, Menu, X, LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard },
  { id: 'pacientes', label: 'Pacientes', icon: Users },
  { id: 'citas', label: 'Citas', icon: Calendar },
  { id: 'jornadas', label: 'Jornadas', icon: Car },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export default function Sidebar({ activeModule, onNavigate, alerts }) {
  const [open, setOpen] = useState(false);
  const { tenant, profile, signOut } = useAuth();
  const alertCount = alerts?.length || 0;
  const initials = (profile?.full_name || 'U').replace(/^(dr|dra)\.?\s+/i, '').split(' ').map((n) => n[0]).join('').slice(0, 2);

  const go = (id) => { onNavigate(id); setOpen(false); };

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-primary text-on-primary p-2 rounded-lg shadow-pine"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-sidebar text-[#e9f0ec] flex flex-col transition-transform duration-300 ${
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Marca */}
        <div className="px-6 pt-6 pb-5">
          <span className="font-display text-xl font-semibold tracking-tight">
            chiropract<span className="text-tertiary-fixed-dim">.</span>co
          </span>
          <p className="text-xs text-[#a9c1b8] mt-2 truncate">{tenant?.name || 'Consultorio'}</p>
          {tenant?.plan && (
            <span className="mt-2.5 inline-flex items-center text-[10px] bg-white/10 text-tertiary-fixed px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Plan {tenant.plan}
            </span>
          )}
        </div>

        {/* Navegación con riel vertebral */}
        <nav className="flex-1 py-2 px-3 relative">
          <div className="absolute left-[26px] top-3 bottom-3 w-0.5 bg-gradient-to-b from-tertiary-fixed-dim/40 to-white/5" />
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                className={`relative w-full flex items-center gap-3 pl-6 pr-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active ? 'bg-white/10 text-white' : 'text-[#bcd0c8] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span
                  className={`absolute left-[13px] w-2.5 h-2.5 rounded-full border-2 border-sidebar transition-colors ${
                    active ? 'bg-tertiary-fixed-dim' : 'bg-[#2c5e51]'
                  }`}
                />
                <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Alertas */}
        <div className="px-3 pb-2">
          <button
            onClick={() => go('dashboard')}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[#bcd0c8] hover:bg-white/5 hover:text-white transition-colors"
          >
            <div className="relative">
              <Bell size={17} />
              {alertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-tertiary-fixed-dim text-[#3a2410] text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {alertCount}
                </span>
              )}
            </div>
            <span>Alertas</span>
          </button>
        </div>

        {/* Pie: usuario */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl amber-gradient flex items-center justify-center text-sm font-bold text-[#3a2410]">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-white">{profile?.full_name || 'Usuario'}</p>
              <p className="text-[11px] text-[#a9c1b8] truncate">{tenant?.name || 'Consultorio'}</p>
            </div>
            <button onClick={signOut} className="text-[#8fb0a6] hover:text-white transition-colors" title="Cerrar sesión">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setOpen(false)} />}
    </>
  );
}
