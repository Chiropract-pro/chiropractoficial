// Edge Function: POST /functions/v1/bold-webhook
// Recibe los eventos de Bold y actualiza el estado del pago.
//
// Configurar en Bold (Panel → Integraciones → Webhook):
//   https://dqxffnibxizlfaeddzrz.supabase.co/functions/v1/bold-webhook
//
// Eventos: SALE_APPROVED · SALE_REJECTED · VOID_APPROVED · VOID_REJECTED
//
// Verificación de firma (doc oficial https://developers.bold.co/webhook):
//   1. Convertir el cuerpo recibido a Base64
//   2. HMAC-SHA256 de ese Base64 usando la LLAVE SECRETA → hex
//   3. Comparar con el encabezado x-bold-signature
//   (En sandbox la llave secreta es cadena vacía.)
//
// IMPORTANTE: se firma el cuerpo EXACTO recibido, así que se lee como texto
// crudo — no se re-serializa el JSON (cambiaría un byte y rompería la firma).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BOLD_SECRET_KEY = Deno.env.get('BOLD_SECRET_KEY') ?? '';

// HMAC-SHA256(base64(body), secret) en hexadecimal
async function boldSignature(rawBody: string, secret: string): Promise<string> {
  // Byte a byte: `String.fromCharCode(...bytes)` desbordaría la pila con
  // payloads grandes. Verificado: produce la misma firma que el ejemplo de Bold,
  // incluso con caracteres no-ASCII (tildes, ñ).
  const bytes = new TextEncoder().encode(rawBody);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const bodyB64 = btoa(binary);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(bodyB64));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Comparación en tiempo constante (evita filtrar la firma por temporización)
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  // Cuerpo crudo: la firma se calcula sobre estos bytes exactos.
  const rawBody = await req.text();

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // 1. Verificar autenticidad
  const received = (req.headers.get('x-bold-signature') || '').trim().toLowerCase();
  const expected = (await boldSignature(rawBody, BOLD_SECRET_KEY)).toLowerCase();
  const sigValid = received.length > 0 && timingSafeEqual(received, expected);

  // 2. Extraer los datos del evento
  const eventType: string = payload?.type || 'unknown';
  const data = payload?.data || {};
  const boldPaymentId: string | null = data?.payment_id || payload?.subject || null;
  const reference: string | null = data?.metadata?.reference || null;
  const amountTotal: number = Number(data?.amount?.total ?? 0);
  const paymentMethod: string | null = data?.payment_method || data?.payment_method_type || null;

  // 3. Resolver el tenant a partir de nuestra referencia
  let tenantId: string | null = null;
  if (reference) {
    const { data: row } = await supabase
      .from('payments').select('tenant_id').eq('reference', reference).maybeSingle();
    tenantId = row?.tenant_id ?? null;
  }

  // 4. Registrar SIEMPRE el evento (auditoría, también si la firma es inválida).
  //    event_id tiene índice único -> si Bold reintenta, no se duplica.
  const { error: logErr } = await supabase.from('bold_events').insert({
    tenant_id: tenantId,
    event_id: payload?.id || null,
    event_type: eventType,
    payment_id: boldPaymentId,
    reference,
    raw_payload: payload,
    signature_valid: sigValid,
  });

  // Violación de unicidad = evento ya recibido antes. Respondemos 200 para que
  // Bold no siga reintentando algo que ya procesamos.
  if (logErr && (logErr as any).code === '23505') {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!sigValid) {
    console.warn('Firma de Bold inválida, evento rechazado');
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!reference) {
    // Firma válida pero sin nuestra referencia: no hay pago que actualizar.
    return new Response(JSON.stringify({ ok: true, ignored: 'sin reference' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  // 5. Aplicar el evento (actualiza pago, crea venta, cierra cita, programa recibo)
  const { error: rpcErr } = await supabase.rpc('apply_bold_event', {
    p_event_type: eventType,
    p_payment_id: boldPaymentId,
    p_reference: reference,
    p_amount: amountTotal,
    p_payment_method: paymentMethod,
    p_raw: payload,
  });

  if (rpcErr) {
    console.error('apply_bold_event error', rpcErr);
    await supabase.from('bold_events')
      .update({ processing_error: rpcErr.message })
      .eq('event_id', payload?.id);
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  await supabase.from('bold_events')
    .update({ processed: true })
    .eq('event_id', payload?.id);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
});
