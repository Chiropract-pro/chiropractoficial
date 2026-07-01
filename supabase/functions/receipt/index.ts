// Edge Function: GET /receipt?sale_id=<uuid>&token=<jwt>
// Genera HTML con el recibo de venta y permite que el paciente lo descargue.
// Usado por n8n y por el portal del paciente.
//
// Deploy: supabase functions deploy receipt
// Invocar:
//   GET https://dqxffnibxizlfaeddzrz.supabase.co/functions/v1/receipt?sale_id=<uuid>
//   Header: Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>  (para n8n)
//   o      Authorization: Bearer <patient_jwt>                 (para paciente autenticado)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount);
}

function escapeHtml(s: string): string {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function pendingHtml(status?: string): string {
  const declined = status === 'declined' || status === 'voided' || status === 'error';
  const title = declined ? 'El pago no se completó' : 'Pago recibido ✓';
  const msg = declined
    ? 'Tu pago no pudo procesarse. Intenta de nuevo o escríbenos por WhatsApp.'
    : 'Estamos generando tu recibo. Esta página se actualizará en unos segundos.';
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${declined ? '' : '<meta http-equiv="refresh" content="5">'}
<title>${title} — chiropract.co</title>
<style>body{font-family:'Inter',-apple-system,sans-serif;max-width:480px;margin:15vh auto;padding:32px;text-align:center;color:#131b2e}
.c{background:#fff;border-radius:16px;padding:40px 32px;box-shadow:0 4px 20px rgba(19,27,46,.06)}
h1{color:${declined ? '#b23c22' : '#005c55'};font-size:22px;margin:0 0 8px}
p{color:#3e4947;font-size:14px;line-height:1.6}
.dot{width:44px;height:44px;border-radius:50%;background:${declined ? '#fdf2f0' : '#e1f5ee'};margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:22px}</style>
</head><body><div class="c"><div class="dot">${declined ? '⚠️' : '✅'}</div>
<h1>${title}</h1><p>${msg}</p></div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  let saleId = url.searchParams.get('sale_id');
  const paymentId = url.searchParams.get('payment_id');

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Redirect de Wompi trae payment_id (no sale_id). Resolvemos el sale asociado.
  // El sale lo crea el webhook de forma asíncrona, así que puede no existir aún.
  if (!saleId && paymentId) {
    const { data: pay } = await supabase
      .from('payments')
      .select('sale_id, status')
      .eq('id', paymentId)
      .maybeSingle();

    if (pay?.sale_id) {
      saleId = pay.sale_id;
    } else {
      // Pago recibido pero el recibo aún se está generando (o el pago no se aprobó).
      return new Response(pendingHtml(pay?.status), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
    }
  }

  if (!saleId) {
    return new Response('Missing sale_id or payment_id', { status: 400, headers: corsHeaders });
  }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('*, sale_items(*), patients(full_name, email, phone), tenants(name, phone, address, city)')
    .eq('id', saleId)
    .single();

  if (saleErr || !sale) {
    return new Response('Receipt not found', { status: 404, headers: corsHeaders });
  }

  const tenant = sale.tenants || {};
  const patient = sale.patients || {};
  const items = sale.sale_items || [];

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Recibo ${saleId.slice(0, 8)} — ${escapeHtml(tenant.name || 'chiropract.co')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 32px auto; padding: 32px; background: #faf8ff; color: #131b2e; }
  .card { background: white; border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(19,27,46,0.06); }
  h1 { color: #005c55; margin: 0 0 4px; font-size: 24px; }
  .sub { color: #3e4947; font-size: 13px; margin-bottom: 24px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eaedff; font-size: 14px; }
  .row:last-child { border: none; }
  .label { color: #3e4947; }
  .total { background: #005c55; color: white; padding: 16px; border-radius: 12px; margin-top: 16px; display: flex; justify-content: space-between; font-weight: 600; font-size: 18px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
  .clinic { text-align: right; font-size: 12px; color: #3e4947; line-height: 1.5; }
  .footer { text-align: center; color: #6e7977; font-size: 11px; margin-top: 32px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th { text-align: left; padding: 8px; background: #eaedff; font-size: 12px; color: #3e4947; }
  td { padding: 10px 8px; border-bottom: 1px solid #eaedff; font-size: 14px; }
  td.num { text-align: right; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; background: ${sale.status === 'completada' ? '#dcfce7' : '#fef3c7'}; color: ${sale.status === 'completada' ? '#166534' : '#92400e'}; }
  @media print { body { background: white; } .card { box-shadow: none; } }
</style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h1>Recibo de servicio</h1>
        <div class="sub">N° ${saleId.slice(0, 8).toUpperCase()} · ${new Date(sale.date).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      <div class="clinic">
        <strong>${escapeHtml(tenant.name || 'chiropract.co')}</strong><br>
        Dr. Miguel Ángel Díaz<br>
        ${escapeHtml(tenant.address || '')}<br>
        ${escapeHtml(tenant.city || '')} · ${escapeHtml(tenant.phone || '')}
      </div>
    </div>

    <div class="row">
      <span class="label">Paciente</span>
      <strong>${escapeHtml(patient.full_name || 'No registrado')}</strong>
    </div>
    <div class="row">
      <span class="label">Estado</span>
      <span class="badge">${escapeHtml(sale.status || '')}</span>
    </div>
    <div class="row">
      <span class="label">Método de pago</span>
      <span>${escapeHtml((sale.payment_method || '').toUpperCase())}</span>
    </div>

    <table>
      <thead>
        <tr><th>Concepto</th><th>Cant.</th><th class="num">Subtotal</th></tr>
      </thead>
      <tbody>
        ${items.map((it: any) => `
          <tr>
            <td>${escapeHtml(it.item_name || '')}</td>
            <td>${it.quantity}</td>
            <td class="num">${formatCOP(Number(it.subtotal) || 0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total">
      <span>Total</span>
      <span>${formatCOP(Number(sale.total) || 0)}</span>
    </div>

    ${sale.notes ? `<p style="font-size:13px; color:#3e4947; margin-top:16px; font-style:italic;">${escapeHtml(sale.notes)}</p>` : ''}

    <div class="footer">
      Gracias por confiar en chiropract.co · El método del Dr. Miguel Ángel Díaz<br>
      Para soporte, escriba al WhatsApp del consultorio.
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, max-age=0, no-cache',
    },
  });
});
