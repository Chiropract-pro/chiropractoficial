// Edge Function: POST /functions/v1/bold-create-link
// Crea un Link de Pago en Bold (bold.co) y registra el intento en `payments`.
// Lo llama el CRM cuando el usuario hace click en "Generar link de pago".
//
// Doc oficial: https://developers.bold.co/pagos-en-linea/api-link-de-pagos
//   POST https://integrations.api.bold.co/online/link/v1
//   Header: Authorization: x-api-key <LLAVE DE IDENTIDAD>
//
// Body (JSON):
//   {
//     "tenant_id": "uuid",
//     "amount": 150000,              // COP, pesos enteros
//     "description": "Consulta inicial",
//     "patient_id": "uuid",          // opcional
//     "appointment_id": "uuid",      // opcional
//     "jornada_id": "uuid",          // opcional
//     "customer_email": "x@y.com",   // opcional
//     "customer_phone": "57311...",  // opcional
//     "expires_in_hours": 24         // opcional (default 24)
//   }
//
// Secretos requeridos:
//   BOLD_IDENTITY_KEY  (llave de identidad — autentica la creación del link)
//   BOLD_SECRET_KEY    (llave secreta — la usa el webhook para validar la firma)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const BOLD_IDENTITY_KEY = Deno.env.get('BOLD_IDENTITY_KEY')!;
const BOLD_API_URL = Deno.env.get('BOLD_API_URL') || 'https://integrations.api.bold.co/online/link/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Token aleatorio (CSPRNG) para que el paciente pueda ver su recibo tras pagar.
function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const {
      tenant_id, amount, description, patient_id, appointment_id, jornada_id,
      customer_email, customer_phone, expires_in_hours,
    } = body;

    if (!tenant_id || !amount) {
      return json({ error: 'tenant_id y amount son obligatorios' }, 400);
    }
    const amountInt = Math.round(Number(amount));
    if (!Number.isFinite(amountInt) || amountInt <= 0) {
      return json({ error: 'amount debe ser un número mayor a 0' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ── AUTORIZACIÓN ─────────────────────────────────────────────────────────
    // Un link de pago cobra dinero real: exigimos service_role (n8n/backend) o un
    // usuario del CRM autenticado que sea miembro aceptado de ESE consultorio.
    const authHeader = req.headers.get('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!bearer) return json({ error: 'No autenticado' }, 401);

    if (bearer !== SERVICE_ROLE) {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      });
      const { data: userData, error: uErr } = await userClient.auth.getUser();
      const user = userData?.user;
      if (uErr || !user) return json({ error: 'Sesión inválida' }, 401);

      const { data: membership } = await supabase
        .from('tenant_memberships')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant_id)
        .not('accepted_at', 'is', null)
        .maybeSingle();

      if (!membership) return json({ error: 'No tienes acceso a este consultorio' }, 403);
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 1. Registrar el intento de cobro (genera reference única)
    const { data: payment, error: pErr } = await supabase.rpc('create_payment_intent', {
      p_tenant_id: tenant_id,
      p_amount: amountInt,
      p_description: description || null,
      p_patient_id: patient_id || null,
      p_appointment_id: appointment_id || null,
      p_jornada_id: jornada_id || null,
      p_customer_email: customer_email || null,
      p_customer_phone: customer_phone || null,
    });

    if (pErr || !payment) {
      console.error('create_payment_intent error', pErr);
      return json({ error: 'No se pudo crear el intento de pago' }, 500);
    }

    const reference = payment.reference;
    const receiptToken = randomToken();

    // Bold expira el link con un timestamp en NANOSEGUNDOS desde epoch.
    const hours = Number(expires_in_hours) > 0 ? Number(expires_in_hours) : 24;
    const expiresAtMs = Date.now() + hours * 3600 * 1000;
    const expirationNs = expiresAtMs * 1_000_000;

    // 2. Crear el Link de Pago en Bold
    const boldPayload: Record<string, unknown> = {
      amount_type: 'CLOSE',
      amount: {
        currency: 'COP',
        total_amount: amountInt,   // Bold recibe COP en pesos enteros (no centavos)
        tip_amount: 0,
      },
      reference,                   // vuelve en el webhook como data.metadata.reference
      description: (description || 'Pago a chiropract.co').slice(0, 100),
      expiration_date: expirationNs,
      callback_url: `${SUPABASE_URL}/functions/v1/receipt?payment_id=${payment.id}&t=${receiptToken}`,
    };
    if (customer_email) boldPayload.payer_email = customer_email;

    const boldResp = await fetch(BOLD_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `x-api-key ${BOLD_IDENTITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(boldPayload),
    });

    const boldData = await boldResp.json().catch(() => ({}));
    const errors = boldData?.errors;
    const linkId = boldData?.payload?.payment_link;
    const checkoutUrl = boldData?.payload?.url;

    if (!boldResp.ok || !checkoutUrl || (Array.isArray(errors) && errors.length > 0)) {
      console.error('Bold error', boldResp.status, JSON.stringify(boldData));
      await supabase.from('payments').update({
        status: 'error',
        provider: 'bold',
        metadata: { ...(payment.metadata || {}), bold_error: boldData },
      }).eq('id', payment.id);

      return json({ error: 'Bold rechazó la solicitud', detail: errors || boldData }, 502);
    }

    // 3. Guardar el link, marcar la pasarela y dejar el token del recibo
    await supabase.from('payments').update({
      provider: 'bold',
      provider_payment_link_id: linkId,
      payment_url: checkoutUrl,
      expires_at: new Date(expiresAtMs).toISOString(),
      metadata: { ...(payment.metadata || {}), receipt_token: receiptToken, bold_link_id: linkId },
    }).eq('id', payment.id);

    return json({
      payment_id: payment.id,
      reference,
      checkout_url: checkoutUrl,
      provider: 'bold',
      expires_at: new Date(expiresAtMs).toISOString(),
    });
  } catch (e) {
    console.error('bold-create-link error', e);
    return json({ error: 'Internal error' }, 500);
  }
});
