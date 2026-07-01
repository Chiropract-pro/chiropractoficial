// Edge Function: GET /functions/v1/patient-me
//                 POST /functions/v1/patient-me  (acciones)
//
// GET — Devuelve dashboard del paciente autenticado.
// Header: Authorization: Bearer <session_token>
//
// Response GET:
//   {
//     "patient": { id, full_name, email, phone, ... },
//     "upcoming_appointments": [...],
//     "recent_sales": [...],
//     "pending_payments": [...]
//   }
//
// POST con body { "action": "logout" }
// POST con body { "action": "cancel_appointment", "appointment_id": uuid, "reason"?: string }
// POST con body { "action": "request_reschedule", "appointment_id": uuid, "preferred_date": "YYYY-MM-DD", "preferred_time": "HH:MM", "notes"?: string }
// POST con body { "action": "get_sale", "sale_id": uuid }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getBearer(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!auth) return null;
  const match = auth.match(/^Bearer\s+([a-fA-F0-9]{32,})$/);
  return match ? match[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const token = getBearer(req);
  if (!token) {
    return jsonResponse({ error: 'Missing or invalid Bearer token' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body?.action;

      if (action === 'logout') {
        await supabase.rpc('patient_session_revoke', { p_token: token });
        return jsonResponse({ ok: true });
      }

      if (action === 'cancel_appointment') {
        if (!body?.appointment_id) return jsonResponse({ error: 'Falta appointment_id' }, 400);
        const { data, error } = await supabase.rpc('patient_cancel_appointment', {
          p_token: token,
          p_appointment_id: body.appointment_id,
          p_reason: body.reason || null,
        });
        if (error) {
          console.error('patient_cancel_appointment', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'request_reschedule') {
        if (!body?.appointment_id || !body?.preferred_date || !body?.preferred_time) {
          return jsonResponse({ error: 'Faltan datos' }, 400);
        }
        const { data, error } = await supabase.rpc('patient_request_reschedule', {
          p_token: token,
          p_appointment_id: body.appointment_id,
          p_preferred_date: body.preferred_date,
          p_preferred_time: body.preferred_time,
          p_notes: body.notes || null,
        });
        if (error) {
          console.error('patient_request_reschedule', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'get_sale') {
        if (!body?.sale_id) return jsonResponse({ error: 'Falta sale_id' }, 400);
        const { data, error } = await supabase.rpc('patient_get_sale', {
          p_token: token,
          p_sale_id: body.sale_id,
        });
        if (error) {
          console.error('patient_get_sale', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'update_profile') {
        const { data, error } = await supabase.rpc('patient_update_profile', {
          p_token: token,
          p_email: body.email ?? null,
          p_address: body.address ?? null,
          p_city: body.city ?? null,
        });
        if (error) {
          console.error('patient_update_profile', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'list_jornadas') {
        const { data, error } = await supabase.rpc('patient_list_jornadas', {
          p_token: token,
          p_limit: body.limit || 10,
        });
        if (error) {
          console.error('patient_list_jornadas', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'book_jornada') {
        if (!body?.jornada_id) return jsonResponse({ error: 'Falta jornada_id' }, 400);
        const { data, error } = await supabase.rpc('patient_book_jornada', {
          p_token: token,
          p_jornada_id: body.jornada_id,
          p_notes: body.notes || null,
        });
        if (error) {
          console.error('patient_book_jornada', error);
          return jsonResponse({ error: error.message }, 400);
        }
        return jsonResponse(data);
      }

      if (action === 'get_clinical_history') {
        const { data, error } = await supabase.rpc('patient_get_clinical_history', {
          p_token: token,
        });
        if (error) {
          console.error('patient_get_clinical_history', error);
          return jsonResponse({ error: error.message }, 401);
        }
        return jsonResponse(data);
      }

      if (action === 'get_file_url') {
        if (!body?.file_id) return jsonResponse({ error: 'Falta file_id' }, 400);
        const { data: storagePath, error } = await supabase.rpc('patient_get_file_storage_path', {
          p_token: token,
          p_file_id: body.file_id,
        });
        if (error || !storagePath) {
          console.error('patient_get_file_storage_path', error);
          return jsonResponse({ error: error?.message || 'Archivo no encontrado' }, 404);
        }
        // Generar signed URL con service role (1 hora)
        const { data: signed, error: signErr } = await supabase.storage
          .from('clinical-files')
          .createSignedUrl(storagePath, 3600);
        if (signErr || !signed?.signedUrl) {
          console.error('createSignedUrl', signErr);
          return jsonResponse({ error: 'No se pudo generar URL' }, 500);
        }
        return jsonResponse({ url: signed.signedUrl, expires_in: 3600 });
      }

      return jsonResponse({ error: 'Acción desconocida' }, 400);
    }

    if (req.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const { data, error } = await supabase.rpc('patient_get_dashboard', { p_token: token });

    if (error) {
      console.error('patient_get_dashboard error', error);
      return jsonResponse({ error: error.message || 'Sesión inválida' }, 401);
    }

    return jsonResponse(data);
  } catch (e) {
    console.error('patient-me fatal', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
