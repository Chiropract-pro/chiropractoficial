// Logger wrapper que silencia detalles en producción (SEC-010).
// En dev se muestra todo. En prod solo se loggea el código de error,
// nunca el message completo (que puede revelar schema o internals).

const isDev = import.meta.env.DEV;

export const logger = {
  error(label, err) {
    if (isDev) {
      console.error(`[${label}]`, err);
      return;
    }
    // En producción solo loggear código y label (sin message ni stack)
    const code = err?.code || err?.status || 'unknown';
    console.error(`[${label}] error ${code}`);
  },

  warn(label, msg) {
    if (isDev) console.warn(`[${label}]`, msg);
  },

  info(label, msg) {
    if (isDev) console.info(`[${label}]`, msg);
  },
};

// Mensaje genérico de error para mostrar al usuario (SEC-012).
// Nunca incluir error.message raw de Supabase/Postgres en UI.
export function userFriendlyError(err) {
  const msg = err?.message || '';
  if (msg.includes('rate limit') || msg.includes('Too many')) {
    return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  }
  if (err?.code === '23505' || msg.includes('duplicate') || msg.includes('already')) {
    return 'Ese registro ya existe.';
  }
  if (err?.code === '23503' || msg.includes('foreign key')) {
    return 'Operación inválida: hay datos relacionados.';
  }
  if (msg.includes('Stock insuficiente')) {
    return msg; // este es seguro mostrar (es nuestro mensaje)
  }
  if (err?.code === '42501' || msg.includes('permission')) {
    return 'No tienes permiso para esta acción.';
  }
  return 'No se pudo completar la operación. Inténtalo de nuevo.';
}
