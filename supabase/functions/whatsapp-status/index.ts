// Edge Function: POST /functions/v1/whatsapp-status
// Estado del WhatsApp del consultorio (Evolution API) y reconexión por QR.
//
// POR QUÉ EXISTE
// El canal de WhatsApp mueve TODO lo crítico: el código OTP con el que el
// paciente entra a su portal, los recordatorios de cita y los recibos. Evolution
// usa WhatsApp Web por debajo, así que la sesión se cae sola cada tanto (se
// cierra sesión en el teléfono, se reinicia el server, pasan días sin uso...).
// Cuando eso ocurre, todo falla en silencio con un 500 y nadie se entera.
//
// Acciones (body: { "action": ... }):
//   "status"  (default) → estado de la instancia
//   "connect"           → devuelve el QR para volver a vincular el teléfono
//   "list"              → todas las instancias del servidor (diagnóstico)
//
// Auth: CRON_SECRET o service_role. Es información y control sensible.

const EVOLUTION_BASE_URL = (Deno.env.get('EVOLUTION_BASE_URL') || '').replace(/\/+$/, '');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

async function evo(path: string, method = 'GET') {
  const res = await fetch(`${EVOLUTION_BASE_URL}${path}`, {
    method,
    headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { status: res.status, ok: res.ok, body };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const ok = (CRON_SECRET && bearer === CRON_SECRET) || (SERVICE_ROLE && bearer === SERVICE_ROLE);
  if (!ok) return json({ error: 'No autorizado' }, 401);

  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return json({
      configurado: false,
      falta: {
        EVOLUTION_BASE_URL: !EVOLUTION_BASE_URL,
        EVOLUTION_API_KEY: !EVOLUTION_API_KEY,
        EVOLUTION_INSTANCE_NAME: !EVOLUTION_INSTANCE,
      },
    }, 500);
  }

  const { action = 'status' } = await req.json().catch(() => ({}));

  if (action === 'list') {
    const r = await evo('/instance/fetchInstances');
    return json({ instancia_configurada: EVOLUTION_INSTANCE, servidor: EVOLUTION_BASE_URL, resultado: r });
  }

  if (action === 'connect') {
    // Devuelve el QR (base64) / pairing code para volver a vincular el teléfono.
    const r = await evo(`/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`);
    return json({ instancia: EVOLUTION_INSTANCE, resultado: r });
  }

  if (action === 'reset') {
    // Cuando Baileys se desconecta con 401 (sesión cerrada desde el teléfono), las
    // credenciales guardadas quedan muertas y la instancia se atasca en 'connecting'
    // intentando restaurarlas: los QR nuevos nunca completan. Hay que cerrar sesión
    // para limpiarlas y recién ahí pedir un QR limpio.
    const out = await evo(`/instance/logout/${encodeURIComponent(EVOLUTION_INSTANCE)}`, 'DELETE');
    await new Promise((r) => setTimeout(r, 1500));
    const fresh = await evo(`/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}`);
    return json({ instancia: EVOLUTION_INSTANCE, logout: out, nuevo_qr: fresh });
  }

  // status
  const state = await evo(`/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`);
  const estado = (state.body as any)?.instance?.state ?? null;

  return json({
    instancia: EVOLUTION_INSTANCE,
    servidor: EVOLUTION_BASE_URL,
    conectado: estado === 'open',
    estado,                       // 'open' = vinculado · 'connecting' · 'close' = caído
    detalle: state,
  });
});
