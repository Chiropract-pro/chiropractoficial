// ============================================================
// Edge Function: POST /send-email
// Renderiza una plantilla de _shared/emails.ts y la envía con Resend.
//
// Auth (dos modos):
//   • Bearer <service_role>  → puede enviar CUALQUIER tipo (backend/n8n/scripts).
//   • Bearer <user_jwt>      → solo tipos de la lista blanca, con chequeo de permiso.
//
// Body: { "type": string, "to": string|string[], "data": object, "cc"?, "reply_to"? }
//
// Secrets requeridos:
//   RESEND_API_KEY   — API key de Resend
//   EMAIL_FROM       — remitente, ej: "chiropract.co <hola@chiropract.co>"
// Deploy: supabase functions deploy send-email
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';
import { renderTemplate } from '../_shared/emails.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || '';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'chiropract.co <onboarding@resend.dev>';

// Tipos que un usuario autenticado (no service_role) puede disparar desde el navegador.
const USER_ALLOWED = new Set(['team_invite']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

async function sendViaResend(payload: Record<string, unknown>) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!RESEND_API_KEY) return json({ error: 'RESEND_API_KEY no configurado' }, 500);

  let payload: { type?: string; to?: string | string[]; data?: Record<string, unknown>; cc?: string | string[]; reply_to?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body inválido' }, 400);
  }

  const { type, to, data = {}, cc, reply_to } = payload;
  if (!type || !to) return json({ error: 'Faltan campos: type y to' }, 400);

  // ---- Autorización ----
  const auth = req.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  const isService = token && token === SERVICE_ROLE;

  if (!isService) {
    // Debe ser un JWT de usuario válido y el tipo debe estar permitido.
    if (!USER_ALLOWED.has(type)) {
      return json({ error: 'No autorizado para enviar este tipo de correo' }, 403);
    }
    const asUser = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await asUser.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'No autenticado' }, 401);

    // team_invite: el usuario solo puede notificar invitaciones que RLS le deja ver.
    if (type === 'team_invite') {
      const tenantId = data.tenant_id;
      const email = data.email || to;
      if (!tenantId) return json({ error: 'Falta tenant_id' }, 400);
      const { data: inv } = await asUser
        .from('tenant_invitations')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('email', email)
        .maybeSingle();
      if (!inv) return json({ error: 'No puedes invitar a este consultorio' }, 403);
    }
  }

  // ---- Render + envío ----
  let subject: string, html: string;
  try {
    ({ subject, html } = renderTemplate(type, data));
  } catch (e) {
    return json({ error: String((e as Error).message) }, 400);
  }

  const resendPayload: Record<string, unknown> = {
    from: EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (cc) resendPayload.cc = Array.isArray(cc) ? cc : [cc];
  if (reply_to) resendPayload.reply_to = reply_to;

  const result = await sendViaResend(resendPayload);
  if (!result.ok) {
    return json({ error: 'Resend rechazó el envío', detail: result.body }, 502);
  }

  // Log ligero (sin datos sensibles)
  const emailId = (result.body as { id?: string })?.id;

  // Registrar el envío para auditoría/idempotencia (best-effort, no bloquea)
  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    await admin.from('email_log').insert({
      type,
      to_email: Array.isArray(to) ? to[0] : to,
      resend_id: emailId,
      subject,
    });
  } catch { /* email_log es opcional */ }

  return json({ ok: true, id: emailId });
});
