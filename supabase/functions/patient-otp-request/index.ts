// Edge Function: POST /functions/v1/patient-otp-request
// Genera un código OTP de 6 dígitos y lo envía vía WhatsApp (Evolution API).
//
// Body (JSON):
//   { "phone": "+573176305076" }
//
// Response:
//   { "ok": true, "expires_at": "2026-05-04T...", "patient_name": "Juan" }
//   (no devolvemos el código — solo se envía por WhatsApp)
//
// Errores:
//   400 - phone inválido
//   404 - sin paciente registrado con ese número
//   429 - rate limit (5 OTPs/hora)
//   500 - Evolution API caída

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVO_BASE = Deno.env.get('EVOLUTION_BASE_URL')!;
const EVO_KEY = Deno.env.get('EVOLUTION_API_KEY')!;
const EVO_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME')!;
const CLINIC_NAME = Deno.env.get('CLINIC_NAME') || 'chiropract.co';

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

async function sendWhatsApp(phoneE164Digits: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `${EVO_BASE}/message/sendText/${encodeURIComponent(EVO_INSTANCE)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: EVO_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        number: phoneE164Digits,
        text,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error('Evolution API error', resp.status, body);
      return { ok: false, error: `Evolution ${resp.status}` };
    }
    return { ok: true };
  } catch (e) {
    console.error('sendWhatsApp exception', e);
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const phone: string = body?.phone || '';

    if (!phone || phone.replace(/\D/g, '').length < 10) {
      return jsonResponse({ error: 'Teléfono inválido' }, 400);
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
    const ua = req.headers.get('user-agent') || null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Genera código OTP en BD (rate limiting interno)
    const { data, error } = await supabase.rpc('patient_otp_create', {
      p_phone: phone,
      p_ip: ip,
      p_user_agent: ua,
    });

    if (error) {
      console.error('patient_otp_create error', error);
      const msg = String(error.message || '');
      if (msg.includes('Demasiados intentos')) {
        return jsonResponse({ error: msg }, 429);
      }
      return jsonResponse({ error: msg || 'Error interno' }, 400);
    }

    const otp = Array.isArray(data) ? data[0] : data;
    if (!otp || !otp.code) {
      return jsonResponse({ error: 'No se pudo generar código' }, 500);
    }

    // 2. Si el paciente NO existe — devolvemos 404 sin enviar nada
    if (!otp.patient_exists) {
      return jsonResponse(
        { error: 'No encontramos un paciente registrado con este número. Habla con tu doctor.' },
        404,
      );
    }

    // 3. Enviar código vía WhatsApp
    const phoneDigits = phone.replace(/\D/g, '');
    const greeting = otp.patient_name ? `Hola ${otp.patient_name.split(' ')[0]} 👋\n\n` : '';
    const message =
      `${greeting}Tu código de acceso a *${CLINIC_NAME}*:\n\n` +
      `🔐 *${otp.code}*\n\n` +
      `Vence en 10 minutos. No lo compartas con nadie.\n\n` +
      `Si no fuiste tú, ignora este mensaje.`;

    const sendResult = await sendWhatsApp(phoneDigits, message);

    if (!sendResult.ok) {
      // El código quedó en BD pero no llegó al WhatsApp — el paciente puede reintentar
      return jsonResponse(
        { error: 'No pudimos enviar el código por WhatsApp. Intenta en un momento.' },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      expires_at: otp.expires_at,
      patient_name: otp.patient_name || null,
    });
  } catch (e) {
    console.error('patient-otp-request fatal', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
