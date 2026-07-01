// Edge Function: POST /functions/v1/wompi-webhook
// Recibe eventos de Wompi (transaction.updated, etc) y actualiza el estado de payments.
// Verifica firma HMAC SHA256 con WOMPI_EVENTS_SECRET para garantizar autenticidad.
//
// Configuración en Wompi:
//   Dashboard → Eventos → URL del endpoint:
//     https://onwgfixvbyknotnbrkgr.supabase.co/functions/v1/wompi-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WOMPI_EVENTS_SECRET = Deno.env.get('WOMPI_EVENTS_SECRET')!;

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Wompi calcula la firma así:
//   1. Concatenar valores de "signature.properties" en orden
//   2. Concatenar timestamp
//   3. Concatenar secret
//   4. SHA256 → checksum
// Luego compara con signature.checksum.
async function verifyWompiSignature(payload: any): Promise<boolean> {
  const sig = payload?.signature;
  if (!sig?.properties || !sig?.checksum) return false;

  let concat = '';
  for (const propPath of sig.properties) {
    // propPath ej: "transaction.id", "transaction.status", etc.
    const value = propPath.split('.').reduce((obj: any, k: string) => obj?.[k], payload?.data) ?? '';
    concat += String(value);
  }
  concat += String(payload.timestamp);
  concat += WOMPI_EVENTS_SECRET;

  const computed = await sha256Hex(concat);
  return computed === sig.checksum;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Verificar firma
  const sigValid = await verifyWompiSignature(payload);

  // 2. Loggear el evento (auditoría)
  const tx = payload?.data?.transaction || {};
  const reference = tx?.reference;

  // Buscar el tenant_id desde el payment con esa reference
  let tenantId: string | null = null;
  if (reference) {
    const { data: paymentRow } = await supabase
      .from('payments')
      .select('tenant_id')
      .eq('reference', reference)
      .maybeSingle();
    tenantId = paymentRow?.tenant_id || null;
  }

  await supabase.from('wompi_events').insert({
    tenant_id: tenantId,
    event_type: payload?.event || 'unknown',
    transaction_id: tx?.id || null,
    reference: reference || null,
    raw_payload: payload,
    signature_valid: sigValid,
  });

  if (!sigValid) {
    console.warn('Invalid Wompi signature, rejecting event');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Procesar el evento via RPC
  if (payload?.event === 'transaction.updated' && reference) {
    const { error: rpcErr } = await supabase.rpc('apply_wompi_event', {
      p_event_type: payload.event,
      p_transaction_id: tx.id || null,
      p_reference: reference,
      p_status: tx.status || 'PENDING',
      p_payment_method: tx?.payment_method?.type || null,
      p_amount_in_cents: tx.amount_in_cents || 0,
      p_customer_email: tx.customer_email || null,
      p_raw: payload,
    });

    if (rpcErr) {
      console.error('apply_wompi_event error', rpcErr);
      await supabase.from('wompi_events').update({
        processing_error: rpcErr.message,
      }).eq('transaction_id', tx.id);

      return new Response(JSON.stringify({ error: 'Processing failed' }), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('wompi_events').update({ processed: true })
      .eq('transaction_id', tx.id)
      .eq('event_type', payload.event);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
