export function formatCOP(amount) {
  if (amount == null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '—';
  const out = date.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  // es-CO devuelve el día en minúscula; estas fechas encabezan paneles.
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function formatShortDate(dateStr) {
  if (!dateStr) return '—';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
  });
}

export const cities = ['Bogotá', 'Soatá', 'Guamal', 'Muzo', 'Garcés Navas'];

// Tarifas de fábrica. Cada consultorio puede sobrescribirlas desde
// Ajustes → Tarifas; esto es solo el punto de partida y la red de seguridad
// para las claves que no haya configurado.
export const appointmentTypes = [
  { value: 'primera_consulta', label: 'Primera consulta', price: 175000 },
  { value: 'seguimiento', label: 'Seguimiento', price: 175000 },
  { value: 'jornada', label: 'Jornada', price: 175000 },
  { value: 'emergencia', label: 'Emergencia', price: 200000 },
];

/**
 * Tipos de cita con las tarifas del consultorio aplicadas.
 * Un valor guardado solo gana si es un número finito y no negativo: así una
 * fila corrupta en la base no hace que el sistema agende citas a NaN pesos.
 */
export function getAppointmentTypes(tenant) {
  const custom = tenant?.appointment_prices;
  if (!custom || typeof custom !== 'object') return appointmentTypes;
  return appointmentTypes.map((t) => {
    const v = Number(custom[t.value]);
    return Number.isFinite(v) && v >= 0 ? { ...t, price: Math.round(v) } : t;
  });
}

export const patientStatuses = [
  { value: 'activo', label: 'Activo', color: 'green' },
  { value: 'inactivo', label: 'Inactivo', color: 'gray' },
  { value: 'en_tratamiento', label: 'En tratamiento', color: 'blue' },
  { value: 'completado', label: 'Completado', color: 'teal' },
];
