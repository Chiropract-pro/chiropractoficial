// Cliente HTTP para las Edge Functions del Panel del Paciente.
// Maneja Bearer token y errores de red de manera uniforme.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const FUNCTIONS_BASE = `${SUPABASE_URL}/functions/v1`;
const STORAGE_KEY = 'chiropract.patient_session';

// ============== Storage helpers ==============
export function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Si expiró, descartar
    if (parsed.expires_at && new Date(parsed.expires_at).getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* localStorage bloqueado en private browsing */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// ============== HTTP helpers ==============
async function fnFetch(path, { method = 'GET', body, token } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let resp;
  try {
    resp = await fetch(`${FUNCTIONS_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new Error('Sin conexión. Verifica tu internet.');
  }

  let data = null;
  try {
    data = await resp.json();
  } catch {
    /* respuesta sin JSON */
  }

  if (!resp.ok) {
    const err = new Error(data?.error || `Error ${resp.status}`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ============== Endpoints ==============
export async function requestOtp(phone) {
  return fnFetch('/patient-otp-request', { method: 'POST', body: { phone } });
}

export async function verifyOtp(phone, code) {
  const data = await fnFetch('/patient-otp-verify', {
    method: 'POST',
    body: { phone, code },
  });
  saveSession(data);
  return data;
}

export async function getMe(token) {
  return fnFetch('/patient-me', { token });
}

export async function logout(token) {
  try {
    await fnFetch('/patient-me', { method: 'POST', body: { action: 'logout' }, token });
  } catch {
    /* logout best-effort */
  } finally {
    clearSession();
  }
}

// ============== Acciones del paciente (Sprint 1.2) ==============
export async function cancelAppointment(token, appointmentId, reason) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'cancel_appointment', appointment_id: appointmentId, reason },
    token,
  });
}

export async function requestReschedule(token, appointmentId, preferredDate, preferredTime, notes) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: {
      action: 'request_reschedule',
      appointment_id: appointmentId,
      preferred_date: preferredDate,
      preferred_time: preferredTime,
      notes,
    },
    token,
  });
}

export async function getSaleDetail(token, saleId) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'get_sale', sale_id: saleId },
    token,
  });
}

// ============== Sprint 1.3 ==============
export async function updateProfile(token, fields) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'update_profile', ...fields },
    token,
  });
}

export async function listJornadas(token, limit = 10) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'list_jornadas', limit },
    token,
  });
}

export async function bookJornada(token, jornadaId, notes) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'book_jornada', jornada_id: jornadaId, notes },
    token,
  });
}

// ============== FASE 2.3 — historia clínica del paciente ==============
export async function getClinicalHistory(token) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'get_clinical_history' },
    token,
  });
}

export async function getFileUrl(token, fileId) {
  return fnFetch('/patient-me', {
    method: 'POST',
    body: { action: 'get_file_url', file_id: fileId },
    token,
  });
}
