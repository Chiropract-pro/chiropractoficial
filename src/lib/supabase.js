import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * ¿Está configurada la conexión?
 *
 * POR QUÉ IMPORTA
 * `createClient(undefined, undefined)` **lanza** `supabaseUrl is required`. Como
 * este módulo se evalúa antes que React, esa excepción mataba la aplicación
 * entera y dejaba la pantalla EN BLANCO, sin un solo mensaje: ni en local sin
 * `.env`, ni en un despliegue al que se le olvidara una variable. Aquí se
 * detecta y la app muestra una pantalla que explica qué falta.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    '[chiropract] Faltan VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY. ' +
    'Copia .env.example a .env.local y completa los valores.',
  );
}

/**
 * Recuperación de contraseña: capturar la intención ANTES de crear el cliente.
 *
 * El enlace del correo llega como `.../#reset-password` + los tokens que Supabase
 * añade al hash (`type=recovery&access_token=...`). Al crear el cliente,
 * supabase-js detecta la sesión y LIMPIA el hash con history.replaceState — que
 * además no dispara `hashchange`. Resultado: cuando React calcula la ruta, el
 * `#reset-password` ya no existe, el usuario entra con la sesión iniciada y nunca
 * ve la pantalla para fijar su contraseña.
 *
 * Por eso leemos el hash aquí arriba (este módulo se evalúa antes que la app) y
 * dejamos una marca en sessionStorage que sobrevive a esa limpieza.
 */
const RECOVERY_FLAG = 'chiro_pw_recovery';

function markRecovery() {
  try { window.sessionStorage.setItem(RECOVERY_FLAG, '1'); } catch { /* modo privado */ }
}

if (typeof window !== 'undefined') {
  const hash = window.location.hash || '';
  const search = window.location.search || '';
  if (
    hash.startsWith('#reset-password') ||
    /[#&?]type=recovery/.test(hash) ||
    /[?&]type=recovery/.test(search)
  ) {
    markRecovery();
  }
}

/** ¿El usuario viene de un enlace de recuperación y aún no fijó su contraseña? */
export function isPasswordRecoveryPending() {
  if (typeof window === 'undefined') return false;
  try { return window.sessionStorage.getItem(RECOVERY_FLAG) === '1'; } catch { return false; }
}

/** Marca el flujo como terminado (tras fijar la contraseña o al cancelar). */
export function clearPasswordRecovery() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(RECOVERY_FLAG); } catch { /* noop */ }
}

/**
 * Cliente inerte para cuando falta configuración: responde a la misma forma
 * que usa la app (from/rpc/functions/auth/storage) devolviendo vacío, de modo
 * que ningún componente reviente mientras se muestra la pantalla de ajuste.
 */
function createStubClient() {
  const err = { message: 'Supabase no está configurado', code: 'NOT_CONFIGURED' };
  const query = {
    select: () => query, eq: () => query, neq: () => query, gt: () => query, gte: () => query,
    lt: () => query, lte: () => query, like: () => query, ilike: () => query, in: () => query,
    is: () => query, or: () => query, order: () => query, limit: () => query, range: () => query,
    insert: () => query, update: () => query, upsert: () => query, delete: () => query,
    single: async () => ({ data: null, error: err }),
    maybeSingle: async () => ({ data: null, error: err }),
    then: (resolve) => resolve({ data: [], error: err }),
  };
  return {
    from: () => query,
    rpc: async () => ({ data: null, error: err }),
    functions: { invoke: async () => ({ data: null, error: err }) },
    auth: {
      getUser: async () => ({ data: { user: null }, error: err }),
      getSession: async () => ({ data: { session: null }, error: err }),
      signInWithPassword: async () => ({ data: null, error: err }),
      signUp: async () => ({ data: null, error: err }),
      signOut: async () => ({ error: null }),
      updateUser: async () => ({ data: null, error: err }),
      resetPasswordForEmail: async () => ({ data: null, error: err }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    storage: {
      from: () => ({
        upload: async () => ({ data: null, error: err }),
        remove: async () => ({ data: null, error: err }),
        list: async () => ({ data: [], error: err }),
        createSignedUrl: async () => ({ data: null, error: err }),
      }),
    },
  };
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createStubClient();

// Segunda red de seguridad: si el evento PASSWORD_RECOVERY llega después del
// arranque, marcamos igual y forzamos la ruta (replaceState no dispara hashchange).
supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    markRecovery();
    if (typeof window !== 'undefined' && !window.location.hash.startsWith('#reset-password')) {
      window.location.hash = 'reset-password';
    }
  }
});
