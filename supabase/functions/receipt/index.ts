// Edge Function: GET /receipt?sale_id=<uuid>&token=<jwt>
// Genera HTML con el recibo de venta y permite que el paciente lo descargue.
// Usado por n8n y por el portal del paciente.
//
// Deploy: supabase functions deploy receipt
// Invocar:
//   GET https://onwgfixvbyknotnbrkgr.supabase.co/functions/v1/receipt?sale_id=<uuid>
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const saleId = url.searchParams.get('sale_id');
  if (!saleId) {
    return new Response('Missing sale_id', { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

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
