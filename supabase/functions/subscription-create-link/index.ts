// Edge Function: POST /functions/v1/subscription-create-link
// Crea un Wompi payment link para activar/renovar plan SaaS.
//
// Auth: Supabase JWT (debe ser owner del tenant)
// Body: { "tenant_id": "uuid", "plan_id": "basic"|"pro", "billing_cycle": "monthly"|"yearly" }
//
// Flow:
//   1. tenant_request_plan_upgrade RPC → subscription_id + amount + plan_name
//   2. create_payment_intent con purpose='subscription_initial'
//   3. POST a Wompi /payment_links
//   4. Devolver { checkout_url, subscription_id }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const WOMPI_PRIVATE = Deno.env.get('WOMPI_PRIVATE_KEY')!;
const WOMPI_INTEGRITY = Deno.env.get('WOMPI_INTEGRITY_SECRET')!;
const WOMPI_BASE = Deno.env.get('WOMPI_BASE_URL') || 'https://production.wompi.co/v1';

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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Falta Bearer token' }, 401);
    }
    const userJwt = authHeader.slice(7);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return jsonResponse({ error: 'Sesión inválida' }, 401);

    const body = await req.json().catch(() => ({}));
    const { tenant_id, plan_id, billing_cycle } = body;

    if (!tenant_id || !plan_id) {
      return jsonResponse({ error: 'Faltan tenant_id o plan_id' }, 400);
    }

    // 1. Validate ownership + create pending subscription via RPC (corre con JWT del usuario)
    const { data: upgrade, error: upgradeErr } = await userClient.rpc('tenant_request_plan_upgrade', {
      p_tenant_id: tenant_id,
      p_plan_id: plan_id,
      p_billing_cycle: billing_cycle || 'monthly',
    });

    if (upgradeErr) {
      return jsonResponse({ error: upgradeErr.message }, 400);
    }

    const { subscription_id, amount, plan_name } = upgrade;

    // 2. Cargar email del owner para customer_email
    const { data: profile } = await adminClient
      .from('profiles')
      .select('full_name, phone')
      .eq('id', user.id)
      .maybeSingle();

    // 3. Crear payment intent con purpose='subscription_initial'
    const { data: payment, error: pErr } = await adminClient.rpc('create_payment_intent', {
      p_tenant_id: tenant_id,
      p_amount: amount,
      p_description: `Plan ${plan_name} (${billing_cycle === 'yearly' ? 'anual' : 'mensual'})`,
      p_customer_email: user.email || null,
      p_customer_phone: profile?.phone || null,
      p_subscription_id: subscription_id,
      p_purpose: 'subscription_initial',
    });

    if (pErr || !payment) {
      console.error('create_payment_intent', pErr);
      return jsonResponse({ error: 'No se pudo crear payment intent' }, 500);
    }

    const reference = payment.reference;
    const amountInCents = amount * 100;

    // 4. Integrity hash
    const integrity = await sha256Hex(`${reference}${amountInCents}COP${WOMPI_INTEGRITY}`);

    // 5. Create payment link en Wompi
    const wompiPayload = {
      name: `Plan ${plan_name} - chiropract.co`,
      description: `Suscripción ${billing_cycle === 'yearly' ? 'anual' : 'mensual'} al plan ${plan_name}`,
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      expires_at: payment.expires_at,
      redirect_url: `${SUPABASE_URL}/functions/v1/receipt?sale_id=${payment.id}`,
    };

    const wompiResp = await fetch(`${WOMPI_BASE}/payment_links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WOMPI_PRIVATE}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(wompiPayload),
    });

    const wompiData = await wompiResp.json();
    if (!wompiResp.ok) {
      console.error('Wompi error', wompiData);
      await adminClient.from('payments').update({
        status: 'error',
        metadata: { wompi_error: wompiData },
      }).eq('id', payment.id);

      return jsonResponse({ error: 'Wompi rechazó la solicitud', detail: wompiData }, 502);
    }

    const linkId = wompiData?.data?.id;
    const checkoutUrl = `https://checkout.wompi.co/l/${linkId}`;

    await adminClient.from('payments').update({
      provider_payment_link_id: linkId,
      payment_url: checkoutUrl,
      metadata: { ...(payment.metadata || {}), integrity_hash: integrity, plan_id, plan_name },
    }).eq('id', payment.id);

    return jsonResponse({
      ok: true,
      subscription_id,
      payment_id: payment.id,
      reference,
      amount,
      checkout_url: checkoutUrl,
      plan_name,
      billing_cycle: billing_cycle || 'monthly',
    });
  } catch (e) {
    console.error('subscription-create-link', e);
    return jsonResponse({ error: String(e?.message || e) }, 500);
  }
});
