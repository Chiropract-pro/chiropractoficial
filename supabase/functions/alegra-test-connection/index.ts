// Edge Function: POST /functions/v1/alegra-test-connection
// Valida que las credenciales Alegra del tenant funcionen.
//
// Auth: Supabase JWT en Authorization
// Body: { "tenant_id": "uuid", "api_email"?: "...", "api_token"?: "..." }
//   - Si vienen api_email/api_token, los usa para test (sin guardar)
//   - Si no, lee tenant_billing_config existente
//
// Response: { ok: true, account_name, numerations: [...] }

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
    const tenantId: string = body?.tenant_id;
    if (!tenantId) return jsonResponse({ error: 'Falta tenant_id' }, 400);

    // Verificar role owner/admin
    const { data: mem } = await userClient
      .from('tenant_memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenantId)
      .not('accepted_at', 'is', null)
      .limit(1);

    if (!mem?.length || !['owner', 'admin'].includes(mem[0].role)) {
      return jsonResponse({ error: 'Solo owner/admin puede probar' }, 403);
    }

    // Cargar credenciales (las del body tienen prioridad para "test antes de guardar")
    let email = body?.api_email;
    let token = body?.api_token;

    if (!email || !token) {
      const { data: cfg } = await adminClient.rpc('get_billing_config_for_emit', {
        p_tenant_id: tenantId,
      });
      // Si no está activa, todavía puede testear: leer raw
      if (!cfg?.api_email || !cfg?.api_token) {
        const { data: raw } = await adminClient
          .from('tenant_billing_config')
          .select('api_email, api_token')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        email = email || raw?.api_email;
        token = token || raw?.api_token;
      } else {
        email = email || cfg.api_email;
        token = token || cfg.api_token;
      }
    }

    if (!email || !token) {
      return jsonResponse({ error: 'Faltan credenciales' }, 400);
    }

    const auth = 'Basic ' + btoa(`${email}:${token}`);

    // GET /company devuelve datos de la cuenta — verifica auth válido
    const companyResp = await fetch(`${ALEGRA_BASE}/company`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });

    if (!companyResp.ok) {
      const text = await companyResp.text();
      const errorMsg = `Alegra rechazó las credenciales (HTTP ${companyResp.status})`;
      // Persistir el resultado del test
      await adminClient.from('tenant_billing_config').upsert({
        tenant_id: tenantId,
        last_test_at: new Date().toISOString(),
        last_test_ok: false,
        last_test_error: text.slice(0, 500),
      });
      return jsonResponse({ ok: false, error: errorMsg, detail: text.slice(0, 200) }, 401);
    }

    const company = await companyResp.json();

    // Obtener numeraciones disponibles (DIAN resolutions)
    const numResp = await fetch(`${ALEGRA_BASE}/number-templates`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });
    const numerations = numResp.ok ? await numResp.json() : [];

    await adminClient.from('tenant_billing_config').upsert({
      tenant_id: tenantId,
      last_test_at: new Date().toISOString(),
      last_test_ok: true,
      last_test_error: null,
    });

    return jsonResponse({
      ok: true,
      account_name: company?.name || company?.businessName || null,
      account_id: company?.id || null,
      numerations: Array.isArray(numerations) ? numerations.map((n: any) => ({
        id: String(n.id),
        name: n.name,
        prefix: n.prefix,
        nextNumber: n.nextInvoiceNumber,
        isElectronic: n.isElectronic,
        isDefault: n.isDefault,
      })) : [],
    });
  } catch (e) {
    console.error('alegra-test-connection error', e);
    return jsonResponse({ ok: false, error: String(e?.message || e) }, 500);
  }
});
