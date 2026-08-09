/**
 * Fechas en la zona horaria del consultorio (Colombia, UTC-5).
 *
 * POR QUÉ EXISTE ESTE ARCHIVO
 * `new Date().toISOString().split('T')[0]` devuelve la fecha en **UTC**, no la
 * local. Como Colombia es UTC-5, a partir de las 19:00 (7pm) el navegador
 * reporta la fecha del día SIGUIENTE. Consecuencia real en el CRM: al cerrar
 * consultorio por la tarde, "citas de hoy" se vaciaba, "ingresos hoy" caía a $0
 * y una venta registrada a las 8pm quedaba fechada al día siguiente.
 *
 * Todas las fechas "de calendario" (YYYY-MM-DD) del sistema deben salir de aquí.
 */

// Zona del consultorio. Configurable por si se abre sede en otro huso.
export const CLINIC_TZ = import.meta.env.VITE_CLINIC_TZ || 'America/Bogota';

/**
 * Construir un `Intl.DateTimeFormat` cuesta caro (del orden de milisegundos).
 * Se creaba uno NUEVO en cada llamada, y con 1.433 pacientes eso suponía 1.433
 * construcciones: el Radar tardaba 3,2 s y congelaba la pantalla. Se crean una
 * sola vez y se reutilizan.
 */
const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

/**
 * Fecha de calendario (YYYY-MM-DD) de un Date, en la zona del consultorio.
 * Usa en-CA porque formatea nativamente como YYYY-MM-DD.
 */
export function toLocalDateStr(date = new Date()) {
  return dateFmt.format(date);
}

/** Hoy (YYYY-MM-DD) en la zona del consultorio. */
export function todayStr() {
  return toLocalDateStr(new Date());
}

/** Mes actual (YYYY-MM) en la zona del consultorio. */
export function monthStr(date = new Date()) {
  return toLocalDateStr(date).slice(0, 7);
}

/** Hora local HH:MM del consultorio (24h). */
export function localTimeStr(date = new Date()) {
  return timeFmt.format(date);
}

/**
 * Suma (o resta, con negativo) días a una fecha y devuelve YYYY-MM-DD local.
 * Opera sobre el mediodía para que el cambio de horario nunca corra un día.
 */
export function addDaysStr(days, from = new Date()) {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  base.setDate(base.getDate() + days);
  return toLocalDateStr(base);
}

/** Un Date a mediodía local a partir de 'YYYY-MM-DD' (evita corrimientos). */
export function parseDateStr(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
}
