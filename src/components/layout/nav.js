import {
  LayoutDashboard, Users, Calendar, Radar, Car, Package, DollarSign, Settings, MessageSquare,
} from 'lucide-react';

/**
 * Un único mapa de navegación para las tres superficies (sidebar de escritorio,
 * barra inferior de móvil y paleta de comandos). Antes la lista vivía dentro
 * del Sidebar y no había forma de reusarla.
 *
 * `primary: true` marca los destinos que caben en la barra inferior del móvil.
 */
export const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel', short: 'Panel', icon: LayoutDashboard, primary: true, hint: 'Resumen del día' },
  { id: 'citas', label: 'Citas', short: 'Citas', icon: Calendar, primary: true, hint: 'Agenda y confirmaciones' },
  { id: 'pacientes', label: 'Pacientes', short: 'Pacientes', icon: Users, primary: true, hint: 'Directorio e historia clínica' },
  { id: 'reactivacion', label: 'Reactivación', short: 'Radar', icon: Radar, primary: true, accent: true, hint: 'A quién llamar hoy' },
  { id: 'conversaciones', label: 'Conversaciones', short: 'Chats', icon: MessageSquare, hint: 'WhatsApp del consultorio' },
  { id: 'finanzas', label: 'Finanzas', short: 'Finanzas', icon: DollarSign, hint: 'Ingresos y cobros' },
  { id: 'jornadas', label: 'Jornadas', short: 'Jornadas', icon: Car, hint: 'Salidas por ciudad' },
  { id: 'productos', label: 'Productos', short: 'Productos', icon: Package, hint: 'Catálogo y punto de venta' },
  { id: 'settings', label: 'Ajustes', short: 'Ajustes', icon: Settings, hint: 'Consultorio, equipo y plan' },
];

export const NAV_BY_ID = Object.fromEntries(NAV_ITEMS.map((i) => [i.id, i]));
