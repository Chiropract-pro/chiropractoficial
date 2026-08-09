// Edge Function: POST /functions/v1/patient-pay-balance
// El PACIENTE genera su propio link de pago para saldar lo que debe, sin que
// nadie del consultorio tenga que hacerlo por él.
//
// Auth: Bearer <session_token del paciente> (el mismo del portal, OTP por WhatsApp).
//
// SEGURIDAD — el monto NO se acepta del cliente:
//   Se lee `patients.balance_due` en el servidor. Si el monto viniera del
//   navegador, cualquiera podría pagar $1 por una deuda de $200.000.
//   Tampoco se acepta patient_id: se deriva de la sesión, así nadie puede
//   generar cobros a nombre de otro paciente.
//
// Body: {} (no necesita nada) — opcionalmente { "amount": n } para un ABONO
// parcial, que se valida contra el saldo real.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const auth = req.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    if (!token) return json({ error: 'No autenticado' }, 401);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Identificar al paciente por su sesión (nunca por lo que mande el cliente)
    const { data: sess, error: sErr } = await supabase.rpc('patient_session_lookup', { p_token: token });
    const s = Array.isArray(sess) ? sess[0] : sess;
    if (sErr || !s?.patient_id) return json({ error: 'Sesión inválida o expirada' }, 401);

    // 2. Leer el saldo REAL del servidor
    const { data: patient } = await supabase
      .from('patients')
      .select('id, tenant_id, full_name, phone, email, balance_due')
      .eq('id', s.patient_id)
      .maybeSingle();

    if (!patient) return json({ error: 'Paciente no encontrado' }, 404);

    const balance = Number(patient.balance_due || 0);
    if (balance <= 0) return json({ error: 'No tienes saldo pendiente' }, 400);

    // 3. Abono parcial opcional, acotado al saldo real
    const body = await req.json().catch(() => ({}));
    let amount = balance;
    if (body?.amount !== undefined && body?.amount !== null) {
      const requested = Math.round(Number(body.amount));
      if (!Number.isFinite(requested) || requested <= 0) {
        return json({ error: 'Monto inválido' }, 400);
      }
      if (requested > balance) {
        return json({ error: 'El monto supera tu saldo pendiente' }, 400);
      }
      amount = requested;
    }

    // 4. Generar el link con la función de Bold (service_role: llamada interna)
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/bold-create-link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant_id: patient.tenant_id,
        amount,
        description: amount === balance
          ? 'Pago de saldo pendiente'
          : 'Abono a saldo pendiente',
        patient_id: patient.id,
        customer_email: patient.email || undefined,
        customer_phone: patient.phone || undefined,
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error('bold-create-link falló', resp.status, data);
      return json({ error: 'No se pudo generar el link de pago' }, 502);
    }

    return json({
      checkout_url: data.checkout_url,
      amount,
      balance_due: balance,
      reference: data.reference,
    });
  } catch (e) {
    console.error('patient-pay-balance', e);
    return json({ error: 'Internal error' }, 500);
  }
});
