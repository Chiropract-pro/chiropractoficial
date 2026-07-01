// Edge Function: POST /functions/v1/patient-otp-verify
// Valida un código OTP y devuelve un session_token para autenticar
// llamadas posteriores del panel del paciente.
//
// Body (JSON):
//   { "phone": "+573176305076", "code": "123456" }
//
// Response 200:
//   {
//     "session_token": "<64 hex chars>",
//     "patient_id": "uuid",
//     "tenant_id": "uuid",
//     "patient_name": "Juan Pérez",
//     "expires_at": "2026-06-04T..."
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone: string = body?.phone || '';
    const code: string = String(body?.code || '');

    if (!phone || !code) {
      return jsonResponse({ error: 'Faltan phone o code' }, 400);
    }

    if (!/^\d{6}$/.test(code)) {
      return jsonResponse({ error: 'Código debe tener 6 dígitos' }, 400);
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ua = req.headers.get('user-agent') || null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data, error } = await supabase.rpc('patient_otp_verify', {
      p_phone: phone,
      p_code: code,
      p_ip: ip,
      p_user_agent: ua,
    });

    if (error) {
      console.error('patient_otp_verify error', error);
      const msg = String(error.message || 'Error de verificación');
      if (msg.includes('Demasiados intentos')) return jsonResponse({ error: msg }, 429);
      if (msg.includes('No encontramos')) return jsonResponse({ error: msg }, 404);
      return jsonResponse({ error: msg }, 401);
    }

    const session = Array.isArray(data) ? data[0] : data;
    if (!session?.session_token) {
      return jsonResponse({ error: 'No se pudo crear sesión' }, 500);
    }

    return jsonResponse({
      session_token: session.session_token,
      patient_id: session.patient_id,
      tenant_id: session.tenant_id,
      patient_name: session.patient_name,
      expires_at: session.expires_at,
    });
  } catch (e) {
    console.error('patient-otp-verify fatal', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
