/**
 * Modo demostración.
 *
 * PARA QUÉ SIRVE
 *  1. Enseñar el producto a un cliente sin exponer un solo dato real de
 *     paciente (Ley 1581/2012) y sin necesitar credenciales.
 *  2. Revisar la interfaz en local cuando no hay `.env`, en vez de mirar una
 *     pantalla en blanco.
 *
 * CÓMO SE ACTIVA
 *  · `#demo` en la URL — p. ej. https://chiropract.co/#demo
 *  · `npm run demo` en local.
 * Se apaga volviendo a cargar sin el hash.
 *
 * Los datos son inventados y viven solo en memoria: nada se escribe.
 */

export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  try {
    // La coincidencia es EXACTA, nunca por subcadena: el hash es además el
    // enrutador público (`#dr/<slug>`), y hay apellidos que al volverse slug
    // contienen «demo» — Demorales, De Moya, Demontis. Con `includes` esos
    // médicos no abrían su perfil: el visitante caía en el consultorio de
    // ejemplo, con pacientes inventados, creyendo que era la ficha del doctor.
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash === 'demo') return true;
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch { return false; }
}

/**
 * Entrar o salir del modo demostración exige recargar.
 *
 * Los módulos de datos leen `isDemoMode()` una sola vez al evaluarse (para no
 * repetir la comprobación en cada render), así que cambiar el hash con la app
 * ya montada dejaba una mezcla: el enrutador creía estar en demostración pero
 * los hooks seguían apuntando a la base. Este vigilante fuerza la recarga en
 * cuanto el modo cambia.
 */
if (typeof window !== 'undefined') {
  const initial = isDemoMode();
  window.addEventListener('hashchange', () => {
    if (isDemoMode() !== initial) window.location.reload();
  });
}

/** Fecha YYYY-MM-DD desplazada N días, en la zona del consultorio. */
function day(offset) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

// ⚠️ NOMBRES FICTICIOS. Nunca usar aquí el nombre de un paciente real:
// este archivo se compila dentro del JavaScript público del sitio, así que
// cualquiera puede leerlo. (Pasó una vez: dos nombres tomados de notas
// internas acabaron publicados en producción.)
const NAMES = [
  'Ana Lucía Bermúdez', 'Camilo Andrés Ferreira', 'Beatriz Elena Zambrano', 'Nicolás Otálora',
  'Paula Ximena Sandoval', 'Julián Esteban Carvajal', 'Mariana Villegas Cortés', 'Sebastián Alzate',
  'Verónica Pineda Rueda', 'Tomás Eduardo Lozano', 'Isabel Cristina Naranjo', 'Mateo Aguirre Solano',
  'Daniela Arboleda Pinzón', 'Emilio Vargas Trujillo', 'Natalia Bustamante', 'Felipe Cuéllar Mora',
  'Adriana Zuluaga Peña', 'Ricardo Espinosa Gil', 'Lorena Camacho Vidal', 'Santiago Buitrago',
  'Carolina Mendoza Prieto', 'Alejandro Peláez Duque', 'Valentina Ocampo Ruiz', 'Martín Escobar Leal',
];
const CITIES = ['Bogotá', 'Soatá', 'Guamal', 'Muzo', 'Garcés Navas'];
const STATUS = ['activo', 'en_tratamiento', 'inactivo', 'completado'];
const TREATMENTS = [
  'Ajuste lumbar · plan de 8 sesiones', 'Cervicalgia crónica', 'Hernia discal L4-L5',
  'Escoliosis funcional', 'Síndrome del túnel carpiano', 'Rehabilitación post-quirúrgica',
];

const patients = NAMES.map((full_name, i) => ({
  id: `demo-p${i}`,
  full_name,
  phone: i % 7 === 3 ? null : `31${i % 10} ${String(2000000 + i * 54321).slice(0, 3)} ${String(4000000 + i * 12345).slice(0, 4)}`,
  email: i % 3 === 0 ? `${full_name.split(' ')[0].toLowerCase()}@correo.com` : null,
  city: CITIES[i % CITIES.length],
  address: `Calle ${20 + i} # ${i + 3}-${10 + i}`,
  status: STATUS[i % STATUS.length],
  treatment: TREATMENTS[i % TREATMENTS.length],
  notes: i % 4 === 0 ? 'Refiere mejoría notable tras la cuarta sesión. Continuar con el plan.' : null,
  total_spent: ((i * 7) % 11) * 150000,
  appointments_count: (i * 3) % 19,
  last_visit: day(-(9 + i * 19)),
  balance_due: i % 5 === 0 ? 87000 + i * 17000 : 0,
  medical_alerts: i % 6 === 0 ? 'Portador de marcapasos — evitar maniobras cervicales de alta velocidad.' : null,
  needs_review: i % 8 === 0,
  id_type: 'CC',
  id_number: `${10000000 + i * 98765}`,
  created_at: day(-420 + i),
  vip: i === 1,
}));

const appointments = [
  { id: 'demo-a1', patient_id: 'demo-p0', patient_name: NAMES[0], date: day(0), time: '08:00', type: 'seguimiento', location: 'consultorio', status: 'completada', price: 100000 },
  { id: 'demo-a2', patient_id: 'demo-p1', patient_name: NAMES[1], date: day(0), time: '09:30', type: 'primera_consulta', location: 'consultorio', status: 'confirmada', price: 150000 },
  { id: 'demo-a3', patient_id: 'demo-p4', patient_name: NAMES[4], date: day(0), time: '11:00', type: 'seguimiento', location: 'consultorio', status: 'pendiente', price: 100000 },
  { id: 'demo-a4', patient_id: 'demo-p7', patient_name: NAMES[7], date: day(0), time: '14:30', type: 'emergencia', location: 'consultorio', status: 'confirmada', price: 200000 },
  { id: 'demo-a5', patient_id: 'demo-p9', patient_name: NAMES[9], date: day(0), time: '16:00', type: 'seguimiento', location: 'consultorio', status: 'pendiente', price: 100000 },
  { id: 'demo-a6', patient_id: 'demo-p2', patient_name: NAMES[2], date: day(1), time: '10:00', type: 'seguimiento', location: 'consultorio', status: 'confirmada', price: 100000 },
  { id: 'demo-a7', patient_id: 'demo-p3', patient_name: NAMES[3], date: day(2), time: '08:30', type: 'jornada', location: 'soata', status: 'pendiente', price: 150000 },
  { id: 'demo-a8', patient_id: 'demo-p5', patient_name: NAMES[5], date: day(-1), time: '15:00', type: 'seguimiento', location: 'consultorio', status: 'completada', price: 100000 },
  { id: 'demo-a9', patient_id: 'demo-p6', patient_name: NAMES[6], date: day(3), time: '09:00', type: 'primera_consulta', location: 'consultorio', status: 'pendiente', price: 150000 },
  { id: 'demo-a10', patient_id: 'demo-p12', patient_name: NAMES[12], date: day(4), time: '11:30', type: 'seguimiento', location: 'consultorio', status: 'confirmada', price: 100000 },
];

// 120 días de ingresos con forma realista (más consultas entre semana).
const transactions = Array.from({ length: 120 }, (_, i) => {
  const date = day(-i);
  const dow = new Date(`${date}T12:00:00`).getDay();
  if (dow === 0) return null;                    // domingo cerrado
  if (i % 4 === 1) return null;                  // días sin registro
  return {
    id: `demo-t${i}`,
    type: 'income',
    amount: [100000, 150000, 200000, 130000, 250000][i % 5],
    category: i % 6 === 0 ? 'jornada' : 'consulta',
    date,
    patient_id: `demo-p${i % patients.length}`,
    description: i % 6 === 0 ? 'Jornada' : 'Consulta en consultorio',
  };
}).filter(Boolean);

const jornadas = [
  { id: 'demo-j1', city: 'Soatá', date: day(9), capacity: 18, booked: 11, price_per_patient: 150000, status: 'programada', notes: 'Salón parroquial. Llevar camilla portátil y dos asistentes.' },
  { id: 'demo-j2', city: 'Muzo', date: day(24), capacity: 15, booked: 4, price_per_patient: 150000, status: 'programada', notes: 'Confirmar hospedaje con la alcaldía.' },
  { id: 'demo-j3', city: 'Guamal', date: day(-21), capacity: 15, booked: 15, price_per_patient: 150000, status: 'completada', revenue: 2250000, notes: 'Jornada llena, lista de espera de 6 personas.' },
  { id: 'demo-j4', city: 'Garcés Navas', date: day(-48), capacity: 12, booked: 9, price_per_patient: 150000, status: 'completada', revenue: 1350000, notes: '' },
];

const services = [
  { id: 'demo-s1', name: 'Primera consulta quiropráctica', category: 'consulta', price: 150000, duration_min: 60, active: true, description: 'Valoración postural completa, historia clínica y primer ajuste.' },
  { id: 'demo-s2', name: 'Sesión de seguimiento', category: 'tratamiento', price: 100000, duration_min: 30, active: true, description: 'Ajuste vertebral y revisión de evolución.' },
  { id: 'demo-s3', name: 'Paquete de 8 sesiones', category: 'paquete', price: 700000, duration_min: 30, active: true, description: 'Plan completo de tratamiento con descuento.' },
  { id: 'demo-s4', name: 'Evaluación postural express', category: 'evaluacion', price: 60000, duration_min: 20, active: false, description: 'Solo disponible en jornadas.' },
];

const products = [
  { id: 'demo-pr1', name: 'Almohada cervical ortopédica', category: 'almohada', sku: 'ALM-01', price: 180000, cost: 95000, stock: 12, low_stock_threshold: 5, active: true },
  { id: 'demo-pr2', name: 'Cinturón lumbar de soporte', category: 'cinturon', sku: 'CIN-02', price: 145000, cost: 70000, stock: 3, low_stock_threshold: 5, active: true },
  { id: 'demo-pr3', name: 'Colágeno hidrolizado 300 g', category: 'suplemento', sku: 'SUP-03', price: 95000, cost: 48000, stock: 24, low_stock_threshold: 6, active: true },
  { id: 'demo-pr4', name: 'Rodillo de liberación miofascial', category: 'accesorio', sku: 'ACC-04', price: 78000, cost: 36000, stock: 2, low_stock_threshold: 4, active: true },
];

const sales = [
  { id: 'demo-v1', total: 280000, status: 'completada', payment_method: 'efectivo', date: day(-2), patient_id: 'demo-p0', patients: { full_name: NAMES[0] }, jornadas: null, sale_items: [{ id: 'di1', quantity: 1, item_name: 'Primera consulta quiropráctica', item_type: 'service', subtotal: 150000 }, { id: 'di2', quantity: 1, item_name: 'Almohada cervical ortopédica', item_type: 'product', subtotal: 130000 }] },
  { id: 'demo-v2', total: 150000, status: 'pendiente', payment_method: 'transferencia', date: day(-1), patient_id: 'demo-p3', patients: { full_name: NAMES[3], phone: '3115550000' }, jornadas: { city: 'Guamal', date: day(-21) }, sale_items: [{ id: 'di3', quantity: 1, item_name: 'Sesión de seguimiento', item_type: 'service', subtotal: 150000 }] },
  { id: 'demo-v3', total: 700000, status: 'completada', payment_method: 'tarjeta', date: day(-9), patient_id: 'demo-p4', patients: { full_name: NAMES[4] }, jornadas: { city: 'Guamal', date: day(-21) }, sale_items: [{ id: 'di4', quantity: 1, item_name: 'Paquete de 8 sesiones', item_type: 'service', subtotal: 700000 }] },
  { id: 'demo-v4', total: 195000, status: 'completada', payment_method: 'nequi', date: day(-30), patient_id: 'demo-p8', patients: { full_name: NAMES[8] }, jornadas: { city: 'Garcés Navas', date: day(-48) }, sale_items: [{ id: 'di5', quantity: 1, item_name: 'Cinturón lumbar de soporte', item_type: 'product', subtotal: 145000 }, { id: 'di6', quantity: 1, item_name: 'Evaluación postural express', item_type: 'service', subtotal: 50000 }] },
];

const alerts = [
  { id: 'demo-al1', type: 'warning', message: '3 pacientes con saldo mayor a $200.000 llevan más de 60 días sin contacto', action: 'ver_finanzas', created_at: day(0) },
  { id: 'demo-al2', type: 'info', message: 'La jornada de Soatá está al 61 % de ocupación', action: 'ver_jornada', created_at: day(-1) },
  { id: 'demo-al3', type: 'danger', message: 'Cinturón lumbar de soporte: quedan 3 unidades', action: 'ver_productos', created_at: day(-1) },
];

const leads = [
  { id: 'demo-l1', date: day(-1), name: 'Consulta por Instagram', status: 'nuevo' },
  { id: 'demo-l2', date: day(-2), name: 'Referido de paciente', status: 'nuevo' },
  { id: 'demo-l3', date: day(-4), name: 'Formulario web', status: 'convertido' },
  { id: 'demo-l4', date: day(-5), name: 'WhatsApp directo', status: 'nuevo' },
  { id: 'demo-l5', date: day(-6), name: 'Consulta por Instagram', status: 'nuevo' },
];

export const DEMO_TENANT = {
  id: 'demo-tenant',
  name: 'Consultorio de demostración',
  slug: 'demo',
  plan: 'pro',
  city: 'Bogotá',
  phone: '310 000 0000',
  address: 'Calle 80 # 20-15',
};

export const DEMO_PROFILE = {
  id: 'demo-user',
  full_name: 'Dr. Miguel Ángel Díaz',
  email: 'demo@chiropract.co',
  phone: '310 000 0000',
  default_tenant_id: 'demo-tenant',
};

/** Filas por tabla, para `useTenantData`. */
export const DEMO_TABLES = {
  patients,
  appointments,
  transactions,
  jornadas,
  services,
  products,
  alerts,
  leads,
  scheduled_content: [],
  reactivation_touches: [],
};

export const DEMO_SALES = sales;

// ── Memoria de la demostración ──────────────────────────────────────────────
// Lo que se crea durante una demostración vive en `sessionStorage`, no solo en
// memoria. Sin esto, agendar una cita frente al cliente y recargar la borraba:
// el sistema parecía no guardar nada. Sigue sin salir del navegador y sigue sin
// tocar la base — al cerrar la pestaña, la demostración vuelve a su estado
// original, que es justo lo que se quiere para la siguiente.
const CLAVE = 'chiropract-demo';

export function demoLoad(table) {
  const semilla = DEMO_TABLES[table] || [];
  try {
    const guardado = sessionStorage.getItem(`${CLAVE}:${table}`);
    return guardado ? JSON.parse(guardado) : [...semilla];
  } catch { return [...semilla]; }
}

export function demoSave(table, rows) {
  try {
    sessionStorage.setItem(`${CLAVE}:${table}`, JSON.stringify(rows));
  } catch { /* cuota llena o modo privado: la demostración sigue, sin recordar */ }
}

/** Devuelve la demostración a su estado inicial (botón «Reiniciar»). */
export function demoReset() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(`${CLAVE}:`))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch { /* nada que limpiar */ }
}

// ── Conversaciones de WhatsApp ──────────────────────────────────────────────
// Nombres inventados, como todo lo demás de la demostración.
const hace = (min) => new Date(Date.now() - min * 60000).toISOString();

export const DEMO_CONVERSATIONS = [
  {
    id: 'conv-1', phone: '573104445566', contact_name: 'Marcela Ospina',
    patient_id: 'p-1', unread_count: 2, last_direction: 'inbound',
    last_message_text: '¿Todavía tienen cupo para el jueves?',
    last_message_at: hace(4), last_inbound_at: hace(4),
    window_expires_at: new Date(Date.now() + 23 * 3600000).toISOString(),
    needs_human: false, last_campaign: 'reactivacion-dormidos',
  },
  {
    id: 'conv-2', phone: '573159998877', contact_name: 'Andrés Gaviria',
    patient_id: 'p-2', unread_count: 0, last_direction: 'outbound',
    last_message_text: 'Le confirmo su cita del martes a las 10:00.',
    last_message_at: hace(75), last_inbound_at: hace(120),
    window_expires_at: new Date(Date.now() + 21 * 3600000).toISOString(),
    needs_human: false, last_campaign: null,
  },
  {
    id: 'conv-3', phone: '573201112233', contact_name: 'Liliana Rueda',
    patient_id: null, unread_count: 1, last_direction: 'inbound',
    last_message_text: 'Quiero hablar con el doctor directamente, por favor.',
    last_message_at: hace(190), last_inbound_at: hace(190),
    window_expires_at: new Date(Date.now() + 20 * 3600000).toISOString(),
    needs_human: true, last_campaign: null,
  },
  {
    id: 'conv-4', phone: '573007776655', contact_name: 'Jorge Peñaloza',
    patient_id: 'p-4', unread_count: 0, last_direction: 'outbound',
    last_message_text: 'Hola Jorge, hace un tiempo no lo vemos por el consultorio…',
    last_message_at: hace(1500), last_inbound_at: null,
    window_expires_at: null,
    needs_human: false, last_campaign: 'reactivacion-dormidos',
  },
];

export const DEMO_WA_MESSAGES = {
  'conv-1': [
    { id: 'm1', direction: 'outbound', sent_by: 'campana', content: 'Hola Marcela, hace unos meses no la vemos por el consultorio. ¿Le gustaría retomar su tratamiento? Tenemos agenda esta semana.', created_at: hace(180), template_name: 'reactivacion_paciente', status: 'read' },
    { id: 'm2', direction: 'inbound', sent_by: 'paciente', content: 'Hola! Sí, me quedé a mitad del tratamiento por trabajo', created_at: hace(90), status: 'delivered' },
    { id: 'm3', direction: 'outbound', sent_by: 'bot', content: 'Con gusto la ayudo a retomar. Tenemos espacio el jueves a las 9:00, 11:00 y 15:00. ¿Cuál le sirve?', created_at: hace(88), status: 'delivered' },
    { id: 'm4', direction: 'inbound', sent_by: 'paciente', content: '¿Todavía tienen cupo para el jueves?', created_at: hace(4), status: 'delivered' },
  ],
  'conv-2': [
    { id: 'm5', direction: 'inbound', sent_by: 'paciente', content: 'Buenas, quiero confirmar mi cita', created_at: hace(120), status: 'delivered' },
    { id: 'm6', direction: 'outbound', sent_by: 'bot', content: 'Le confirmo su cita del martes a las 10:00.', created_at: hace(75), status: 'read' },
  ],
  'conv-3': [
    { id: 'm7', direction: 'inbound', sent_by: 'paciente', content: 'Quiero hablar con el doctor directamente, por favor.', created_at: hace(190), status: 'delivered' },
  ],
  'conv-4': [
    { id: 'm8', direction: 'outbound', sent_by: 'campana', content: 'Hola Jorge, hace un tiempo no lo vemos por el consultorio…', created_at: hace(1500), template_name: 'reactivacion_paciente', status: 'sent' },
  ],
};

/** Suscripción de ejemplo: en demostración la pestaña Plan enseña un Pro activo. */
// ── Resultados de la reactivación automática ────────────────────────────────
// Lo que devolvería `reactivation_report`: a quién le escribió el bot y qué
// pasó después. Los desenlaces se calculan en la base cruzando el contacto con
// mensajes y citas; aquí van fijos porque es una demostración.
export const DEMO_REACTIVACION = [
  { touch_id: 'rt-1', patient_id: 'demo-p6', full_name: NAMES[6], phone: '573162324074',
    segment: 'dormido', estimated_value: 165000, sent_at: hace(120), replied_at: hace(95),
    booked_at: hace(90), appointment_date: day(3), outcome: 'volvio' },
  { touch_id: 'rt-2', patient_id: 'demo-p12', full_name: NAMES[12], phone: '573122654148',
    segment: 'primera', estimated_value: 165000, sent_at: hace(240), replied_at: hace(230),
    booked_at: hace(228), appointment_date: day(4), outcome: 'volvio' },
  { touch_id: 'rt-3', patient_id: 'demo-p18', full_name: NAMES[18], phone: '573182974222',
    segment: 'dormido', estimated_value: 165000, sent_at: hace(400), replied_at: hace(380),
    booked_at: null, appointment_date: null, outcome: 'respondio' },
  { touch_id: 'rt-4', patient_id: 'demo-p9', full_name: NAMES[9], phone: '573192484111',
    segment: 'primera', estimated_value: 165000, sent_at: hace(1500), replied_at: hace(1440),
    booked_at: null, appointment_date: null, outcome: 'respondio' },
  { touch_id: 'rt-5', patient_id: 'demo-p14', full_name: NAMES[14], phone: '573142764172',
    segment: 'dormido', estimated_value: 165000, sent_at: hace(2900), replied_at: null,
    booked_at: null, appointment_date: null, outcome: 'sin_respuesta' },
  { touch_id: 'rt-6', patient_id: 'demo-p21', full_name: NAMES[21], phone: '573113144259',
    segment: 'primera', estimated_value: 165000, sent_at: hace(4300), replied_at: null,
    booked_at: null, appointment_date: null, outcome: 'sin_respuesta' },
  { touch_id: 'rt-7', patient_id: 'demo-p3', full_name: NAMES[3], phone: '573001112233',
    segment: 'abandono', estimated_value: 165000, sent_at: hace(5800), replied_at: null,
    booked_at: null, appointment_date: null, outcome: 'sin_respuesta' },
];

export const DEMO_SUBSCRIPTION = {
  tenant_id: 'demo-tenant',
  plan_id: 'pro',
  plan_name: 'Pro',
  plan_tagline: 'Para consultorios en crecimiento',
  status: 'active',
  current_period_end: day(23),
  days_remaining: 23,
  cancel_at_period_end: false,
  max_patients: 1000,
  max_users: 10,
  price_cop_monthly: 399000,
};

export const DEMO_PLANS = [
  { id: 'basic', name: 'Basic', tagline: 'Para empezar', price_cop_monthly: 199000, max_patients: 300, max_users: 3, is_public: true, display_order: 1 },
  { id: 'pro', name: 'Pro', tagline: 'Para consultorios en crecimiento', price_cop_monthly: 399000, max_patients: 1000, max_users: 10, is_public: true, display_order: 2 },
];


// ── Equipo y perfil público de la demostración ──────────────────────────────
export const DEMO_EQUIPO = [
  {
    id: 'mem-1', user_id: 'u-1', role: 'owner',
    accepted_at: new Date(Date.now() - 90 * 86400000).toISOString(),
    profiles: { id: 'u-1', full_name: 'Dr. Miguel Ángel Díaz', phone: '310 000 0000', avatar_url: null },
  },
  {
    id: 'mem-2', user_id: 'u-2', role: 'receptionist',
    accepted_at: new Date(Date.now() - 40 * 86400000).toISOString(),
    profiles: { id: 'u-2', full_name: 'Laura Restrepo', phone: '311 000 0000', avatar_url: null },
  },
];

export const DEMO_PERFIL_PUBLICO = {
  id: 'perfil-demo',
  title: 'Dr.',
  full_name: 'Miguel Ángel Díaz',
  headline: 'Quiropráctico · Salud espinal de precisión',
  bio: 'Atención quiropráctica en Bogotá y jornadas en municipios. Enfoque en dolor lumbar, cervical y recuperación postural.',
  city: 'Bogotá',
  slug: 'demo',
  is_public: true,
  verified: true,
  photo_url: null,
};
