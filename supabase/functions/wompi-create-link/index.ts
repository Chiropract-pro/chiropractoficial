// Edge Function: POST /functions/v1/wompi-create-link
// Crea un Payment Link en Wompi y registra el intento en `payments`.
// Llamada desde el CRM cuando el usuario hace click en "Generar link de pago".
//
// Body (JSON):
//   {
//     "tenant_id": "uuid",
//     "amount": 150000,            // en COP (no en cents — Wompi usa pesos enteros para COP)
//     "description": "Consulta inicial",
//     "patient_id": "uuid",        // opcional
//     "appointment_id": "uuid",    // opcional
//     "jornada_id": "uuid",        // opcional
//     "customer_email": "x@y.com", // opcional
//     "customer_phone": "57311..." // opcional
//   }
//
// Response:
//   {
//     "payment_id": "uuid",
//     "reference": "chiro-...",
//     "checkout_url": "https://checkout.wompi.co/l/<id>",
//     "expires_at": "2026-04-29T..."
//   }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WOMPI_PRIVATE = Deno.env.get('WOMPI_PRIVATE_KEY')!;
const WOMPI_INTEGRITY = Deno.env.get('WOMPI_INTEGRITY_SECRET')!;
const WOMPI_BASE = Deno.env.get('WOMPI_BASE_URL') || 'https://production.wompi.co/v1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    const { tenant_id, amount, description, patient_id, appointment_id, jornada_id, customer_email, customer_phone } = body;

    if (!tenant_id || !amount) {
      return new Response(JSON.stringify({ error: 'tenant_id y amount son obligatorios' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Crear payment intent en BD (genera reference única)
    const { data: payment, error: pErr } = await supabase.rpc('create_payment_intent', {
      p_tenant_id: tenant_id,
      p_amount: amount,
      p_description: description || null,
      p_patient_id: patient_id || null,
      p_appointment_id: appointment_id || null,
      p_jornada_id: jornada_id || null,
      p_customer_email: customer_email || null,
      p_customer_phone: customer_phone || null,
    });

    if (pErr || !payment) {
      console.error('create_payment_intent error', pErr);
      return new Response(JSON.stringify({ error: 'No se pudo crear el payment intent' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reference = payment.reference;
    const amountInCents = amount * 100; // Wompi recibe centavos para COP

    // 2. Calcular integrity hash: sha256(reference + amountInCents + currency + integrity_secret)
    const integrity = await sha256Hex(`${reference}${amountInCents}COP${WOMPI_INTEGRITY}`);

    // 3. Crear Payment Link en Wompi
    const wompiPayload = {
      name: description || 'Consulta chiropract.co',
      description: description || 'Pago a chiropract.co',
      single_use: true,
      collect_shipping: false,
      currency: 'COP',
      amount_in_cents: amountInCents,
      expires_at: payment.expires_at,
      redirect_url: `${SUPABASE_URL.replace('.supabase.co', '.supabase.co')}/functions/v1/receipt?sale_id=${payment.id}`,
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
      await supabase.from('payments').update({
        status: 'error',
        metadata: { wompi_error: wompiData },
      }).eq('id', payment.id);

      return new Response(JSON.stringify({ error: 'Wompi rechazó la solicitud', detail: wompiData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const linkId = wompiData?.data?.id;
    const checkoutUrl = `https://checkout.wompi.co/l/${linkId}`;

    // 4. Guardar el link y URL en payments
    await supabase.from('payments').update({
      provider_payment_link_id: linkId,
      payment_url: checkoutUrl,
      metadata: { ...(payment.metadata || {}), integrity_hash: integrity },
    }).eq('id', payment.id);

    return new Response(JSON.stringify({
      payment_id: payment.id,
      reference,
      checkout_url: checkoutUrl,
      expires_at: payment.expires_at,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('wompi-create-link error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
