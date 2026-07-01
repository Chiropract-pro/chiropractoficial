// Edge Function: POST /functions/v1/alegra-emit-invoice
// Emite factura electrónica DIAN vía Alegra para un sale existente.
//
// Auth: Supabase JWT en Authorization header (verifica membership en tenant)
// Body: { "sale_id": "uuid" }
//
// Flow:
//   1. Verifica usuario y membership en tenant
//   2. Carga sale + patient + items + tenant_billing_config (active=true)
//   3. Validaciones DIAN: paciente con id_type+id_number, items con precio
//   4. POST a Alegra /contacts (upsert) — crea/actualiza el cliente
//   5. POST a Alegra /invoices con stamp { generateStamp: true } → DIAN
//   6. Update sale con e_invoice_*
//
// Returns:
//   { invoice_id, cufe, pdf_url, status }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const ALEGRA_BASE = 'https://api.alegra.com/api/v1';

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

function basicAuth(email: string, token: string): string {
  return 'Basic ' + btoa(`${email}:${token}`);
}

async function alegraFetch(path: string, opts: { method?: string; body?: any; auth: string; }) {
  const resp = await fetch(`${ALEGRA_BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: opts.auth,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await resp.text();
  let data: any;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  return { ok: resp.ok, status: resp.status, data };
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

    // Cliente con JWT del usuario para validar membership
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });

    // Cliente service-role para acceder a tenant_billing_config y RPCs internas
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return jsonResponse({ error: 'Sesión inválida' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const saleId: string = body?.sale_id;
    if (!saleId) return jsonResponse({ error: 'Falta sale_id' }, 400);

    // 1. Cargar sale completo
    const { data: bundle, error: bundleErr } = await adminClient.rpc('get_sale_for_emit', { p_sale_id: saleId });
    if (bundleErr || !bundle?.sale) {
      return jsonResponse({ error: 'Venta no encontrada' }, 404);
    }

    const { sale, patient, items, tenant } = bundle;

    // 2. Verificar que el usuario es miembro del tenant
    const { data: memberships, error: memErr } = await userClient
      .from('tenant_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', sale.tenant_id)
      .not('accepted_at', 'is', null);

    if (memErr || !memberships?.length) {
      return jsonResponse({ error: 'No tienes acceso a esta venta' }, 403);
    }

    const role = memberships[0].role;
    if (!['owner', 'admin', 'doctor', 'receptionist'].includes(role)) {
      return jsonResponse({ error: 'Tu rol no puede emitir facturas' }, 403);
    }

    // 3. Estado actual
    if (sale.e_invoice_status === 'accepted' && sale.e_invoice_id) {
      return jsonResponse({
        error: 'Esta venta ya tiene factura electrónica emitida',
        invoice_id: sale.e_invoice_id,
        cufe: sale.e_invoice_cufe,
        pdf_url: sale.e_invoice_pdf_url,
      }, 409);
    }

    // 4. Cargar billing config
    const { data: config, error: cfgErr } = await adminClient.rpc('get_billing_config_for_emit', {
      p_tenant_id: sale.tenant_id,
    });

    if (cfgErr || !config) {
      return jsonResponse({
        error: 'Tu consultorio no tiene configurada la facturación DIAN. Ve a Settings → Facturación.',
      }, 412);
    }

    if (!config.api_email || !config.api_token) {
      return jsonResponse({ error: 'Faltan credenciales de Alegra' }, 412);
    }

    // 5. Validaciones DIAN
    if (!patient?.id_type || !patient?.id_number) {
      return jsonResponse({
        error: 'El paciente no tiene tipo ni número de identificación. Edítalo antes de facturar.',
      }, 422);
    }

    if (!items?.length) {
      return jsonResponse({ error: 'La venta no tiene items' }, 422);
    }

    if (!sale.total || sale.total <= 0) {
      return jsonResponse({ error: 'La venta tiene total cero o inválido' }, 422);
    }

    const auth = basicAuth(config.api_email, config.api_token);

    // 6. Mark sale as pending mientras emite
    await adminClient.from('sales').update({
      e_invoice_status: 'pending',
      e_invoice_error: null,
    }).eq('id', saleId);

    try {
      // 7. Upsert contact en Alegra
      const contactPayload = {
        name: patient.full_name,
        identification: {
          type: patient.id_type,
          number: String(patient.id_number).replace(/\D/g, ''),
        },
        email: patient.email || undefined,
        mobile: patient.phone ? String(patient.phone).replace(/\D/g, '') : undefined,
        address: patient.address ? {
          address: patient.address,
          city: patient.city || tenant?.city || 'Bogotá',
          country: 'Colombia',
        } : undefined,
        type: 'client',
      };

      // Buscar contacto existente por identification
      let contactId: number | null = null;
      const searchResp = await alegraFetch(
        `/contacts?identification=${encodeURIComponent(contactPayload.identification.number)}`,
        { auth },
      );
      if (searchResp.ok && Array.isArray(searchResp.data) && searchResp.data.length > 0) {
        contactId = searchResp.data[0].id;
      } else {
        const createResp = await alegraFetch('/contacts', {
          method: 'POST',
          body: contactPayload,
          auth,
        });
        if (!createResp.ok) {
          throw new Error(`Alegra contact: ${JSON.stringify(createResp.data)}`);
        }
        contactId = createResp.data.id;
      }

      // 8. Crear invoice en Alegra
      const invoiceItems = items.map((it: any) => ({
        name: it.item_name,
        price: it.unit_price,
        quantity: it.quantity,
        // Sin impuestos por defecto — el doctor puede agregar IVA en items específicos
        tax: [],
      }));

      const today = new Date().toISOString().slice(0, 10);
      const dueDate = today;

      const invoicePayload: any = {
        date: today,
        dueDate,
        client: contactId,
        items: invoiceItems,
        observations: `Venta CRM ${String(sale.id).slice(0, 8)}`,
        anotation: sale.notes || undefined,
        // Stamp para emitir a DIAN
        stamp: { generateStamp: true },
        paymentForm: 'CASH',
        paymentMethod: (sale.payment_method || 'cash').toUpperCase(),
        // Numeración
        ...(config.resolution_id ? { numberTemplate: { id: config.resolution_id } } : {}),
      };

      const invResp = await alegraFetch('/invoices', {
        method: 'POST',
        body: invoicePayload,
        auth,
      });

      if (!invResp.ok) {
        const errMsg = invResp.data?.message ||
          (invResp.data?.errors && JSON.stringify(invResp.data.errors)) ||
          JSON.stringify(invResp.data).slice(0, 500);

        await adminClient.from('sales').update({
          e_invoice_status: 'error',
          e_invoice_error: errMsg,
          e_invoice_metadata: { last_attempt: new Date().toISOString(), error: invResp.data },
        }).eq('id', saleId);

        return jsonResponse({ error: errMsg }, 502);
      }

      const inv = invResp.data;
      const cufe = inv?.stamp?.cufe || inv?.stamp?.uuid || null;
      const pdfUrl = inv?.pdf || inv?.preview || null;
      const xmlUrl = inv?.stamp?.xmlBase64Path || inv?.xml || null;

      const stampStatus = inv?.stamp?.legalStatus || inv?.stamp?.status || 'sent';
      const finalStatus =
        stampStatus === 'STAMPED' || stampStatus === 'ACCEPTED' || stampStatus === 'accepted'
          ? 'accepted'
          : (stampStatus === 'rejected' || stampStatus === 'REJECTED' ? 'rejected' : 'sent');

      await adminClient.from('sales').update({
        e_invoice_id: String(inv.id),
        e_invoice_number: inv.number?.toString() || inv.numberTemplate?.fullNumber || null,
        e_invoice_cufe: cufe,
        e_invoice_pdf_url: pdfUrl,
        e_invoice_xml_url: xmlUrl,
        e_invoice_status: finalStatus,
        e_invoice_emitted_at: new Date().toISOString(),
        e_invoice_metadata: {
          alegra_id: inv.id,
          stamp: inv.stamp || null,
          number: inv.number,
        },
        e_invoice_error: null,
      }).eq('id', saleId);

      return jsonResponse({
        ok: true,
        invoice_id: inv.id,
        invoice_number: inv.number?.toString() || inv.numberTemplate?.fullNumber,
        cufe,
        pdf_url: pdfUrl,
        xml_url: xmlUrl,
        status: finalStatus,
      });
    } catch (e) {
      console.error('alegra-emit-invoice error', e);
      await adminClient.from('sales').update({
        e_invoice_status: 'error',
        e_invoice_error: String(e?.message || e).slice(0, 500),
      }).eq('id', saleId);

      return jsonResponse({ error: String(e?.message || e) }, 500);
    }
  } catch (e) {
    console.error('alegra-emit-invoice fatal', e);
    return jsonResponse({ error: 'Internal error' }, 500);
  }
});
