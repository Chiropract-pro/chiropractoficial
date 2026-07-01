import { LayoutDashboard, Users, Calendar, Car, Package, DollarSign, Bell, Menu, X, LogOut, Globe, Settings } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'pacientes', label: 'Pacientes', icon: Users },
  { id: 'citas', label: 'Citas', icon: Calendar },
  { id: 'jornadas', label: 'Jornadas', icon: Car },
  { id: 'productos', label: 'Productos y Servicios', icon: Package },
  { id: 'finanzas', label: 'Finanzas', icon: DollarSign },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export default function Sidebar({ activeModule, onNavigate, alerts }) {
  const [collapsed, setCollapsed] = useState(false);
  const { tenant, profile, signOut } = useAuth();
  const alertCount = alerts?.length || 0;

  const initials = (profile?.full_name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2);

  return (
    <>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 lg:hidden bg-sidebar text-white p-2 rounded-lg shadow-lg"
      >
        {collapsed ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 bg-sidebar text-white flex flex-col transition-all duration-300 ${
          collapsed ? 'w-64 translate-x-0' : '-translate-x-full lg:translate-x-0 lg:w-64'
        }`}
      >
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <img src="/logos/v1-light.svg" alt="chiropract.co" className="h-9 w-auto" />
          <p className="text-xs text-white/60 mt-3">{tenant?.name || 'CRM — Gestión Integral'}</p>
          {tenant?.plan && (
            <span className="mt-2 inline-flex items-center gap-1 text-[10px] bg-primary/20 text-primary-light px-2 py-0.5 rounded-full font-bold uppercase">
              <Globe size={10} /> {tenant.plan}
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setCollapsed(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-lg shadow-primary/30'
                    : 'text-white/70 hover:bg-sidebar-hover hover:text-white'
                }`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Alerts */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={() => {
              onNavigate('dashboard');
              setCollapsed(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-white/70 hover:bg-sidebar-hover hover:text-white transition-all"
          >
            <div className="relative">
              <Bell size={18} />
              {alertCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                  {alertCount}
                </span>
              )}
            </div>
            <span>Alertas</span>
            {alertCount > 0 && (
              <span className="ml-auto bg-danger/20 text-danger text-xs px-2 py-0.5 rounded-full">
                {alertCount}
              </span>
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-8 h-8 rounded-full clinical-gradient flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name || 'Usuario'}</p>
              <p className="text-xs text-white/60 truncate capitalize">{tenant?.name || 'Consultorio'}</p>
            </div>
            <button
              onClick={signOut}
              className="text-white/50 hover:text-white transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
          <p className="text-[10px] text-white/40 text-center">by chiropract.co & Invent Agency</p>
        </div>
      </aside>

      {collapsed && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setCollapsed(false)}
        />
      )}
    </>
  );
}
