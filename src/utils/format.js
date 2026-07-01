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
  return date.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
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

export const appointmentTypes = [
  { value: 'primera_consulta', label: 'Primera consulta', price: 150000 },
  { value: 'seguimiento', label: 'Seguimiento', price: 100000 },
  { value: 'jornada', label: 'Jornada', price: 150000 },
  { value: 'emergencia', label: 'Emergencia', price: 200000 },
];

export const patientStatuses = [
  { value: 'activo', label: 'Activo', color: 'green' },
  { value: 'inactivo', label: 'Inactivo', color: 'gray' },
  { value: 'en_tratamiento', label: 'En tratamiento', color: 'blue' },
  { value: 'completado', label: 'Completado', color: 'teal' },
];
