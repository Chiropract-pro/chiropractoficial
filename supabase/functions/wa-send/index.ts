// Edge Function: POST /functions/v1/wa-send
// Enviar un WhatsApp desde el CRM, por la línea del consultorio (Meta Cloud API).
//
// POR QUÉ EXISTE
// La pantalla de Conversaciones dejaba escribir y el botón «Enviar» llamaba a
// esta función… que nunca se escribió. Es decir: el chat del CRM no podía
// responderle a un paciente. Todo lo que llegaba se leía; nada salía.
//
// POR QUÉ NO SE HACE DESDE EL NAVEGADOR
// El token de Meta no puede vivir en el cliente: quien abriera el inspector
// podría escribirle a cualquier número desde el WhatsApp del consultorio.
//
// LA VENTANA DE 24 HORAS
// Meta solo permite texto libre dentro de las 24 h posteriores al último
// mensaje del paciente; fuera de eso hay que usar una plantilla aprobada. La
// interfaz ya lo impide, pero aquí se vuelve a comprobar: una regla que solo
// vive en el cliente no es una regla.
//
// Auth: el JWT del usuario del CRM. Se exige que sea miembro del consultorio
// dueño de la conversación — si no, cualquiera con una cuenta podría escribirle
// a los pacientes de otro consultorio.
//
// Secretos: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID, SUPABASE_URL,
//           SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const WA_TOKEN = Deno.env.get('WHATSAPP_TOKEN') || '';
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') || '';
const GRAPH = 'https://graph.facebook.com/v23.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Celular colombiano a E.164 sin «+», que es como lo quiere Meta. */
function normalizar(tel: string): string | null {
  const d = String(tel || '').replace(/\D/g, '');
  const con57 = d.length === 10 ? `57${d}` : d;
  return /^573\d{9}$/.test(con57) ? con57 : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  if (!WA_TOKEN || !WA_PHONE_ID) {
    return json({ error: 'La línea de WhatsApp no está configurada en el servidor.' }, 500);
  }

  // ── Quién está escribiendo ────────────────────────────────────────────────
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'No autorizado' }, 401);

  const comoUsuario = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
  const { data: sesion } = await comoUsuario.auth.getUser();
  const user = sesion?.user;
  if (!user) return json({ error: 'Sesión no válida' }, 401);

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: 'Cuerpo inválido' }, 400); }

  const { conversation_id, phone, text, template_name, campaign } = cuerpo as {
    conversation_id?: string | null; phone?: string;
    text?: string | null; template_name?: string | null; campaign?: string | null;
  };

  const destino = normalizar(String(phone || ''));
  if (!destino) return json({ error: 'El número no es un celular colombiano válido.' }, 400);
  if (!text?.trim() && !template_name) return json({ error: 'No hay nada que enviar.' }, 400);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── ¿Este usuario puede escribirle a este paciente? ───────────────────────
  const { data: membresias } = await admin
    .from('tenant_memberships')
    .select('tenant_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null);

  const suyos = (membresias || []).map((m: { tenant_id: string }) => m.tenant_id);
  if (suyos.length === 0) return json({ error: 'No perteneces a ningún consultorio.' }, 403);

  // La conversación manda: si viene, tiene que ser de un consultorio suyo.
  let tenantId = suyos[0];
  let ventanaAbierta = false;

  const { data: conv } = conversation_id
    ? await admin.from('whatsapp_conversations')
      .select('id, tenant_id, window_expires_at').eq('id', conversation_id).maybeSingle()
    : await admin.from('whatsapp_conversations')
      .select('id, tenant_id, window_expires_at')
      .in('tenant_id', suyos)
      .filter('phone', 'like', `%${destino.slice(-10)}%`)
      .order('last_message_at', { ascending: false })
      .limit(1).maybeSingle();

  if (conv) {
    if (!suyos.includes(conv.tenant_id)) {
      return json({ error: 'Esa conversación no es de tu consultorio.' }, 403);
    }
    tenantId = conv.tenant_id;
    ventanaAbierta = Boolean(conv.window_expires_at &&
      new Date(conv.window_expires_at).getTime() > Date.now());
  }

  // ── La regla de Meta, comprobada también aquí ─────────────────────────────
  if (!template_name && !ventanaAbierta) {
    return json({
      error: 'Pasaron más de 24 horas desde el último mensaje del paciente. '
        + 'Para retomar hay que usar una plantilla aprobada.',
      needs_template: true,
    }, 409);
  }

  // ── Enviar ────────────────────────────────────────────────────────────────
  const payload = template_name
    ? {
      messaging_product: 'whatsapp', to: destino, type: 'template',
      template: { name: template_name, language: { code: 'es' } },
    }
    : {
      messaging_product: 'whatsapp', to: destino, type: 'text',
      text: { body: text!.trim() },
    };

  const res = await fetch(`${GRAPH}/${WA_PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${WA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const respuesta = await res.json().catch(() => ({}));

  if (!res.ok) {
    // El mensaje de Meta es útil para el usuario («número no válido», «plantilla
    // no existe»): se pasa tal cual en vez de un «algo salió mal».
    const detalle = respuesta?.error?.message || 'Meta rechazó el envío.';
    return json({ error: detalle, meta_code: respuesta?.error?.code }, 502);
  }

  const wamid = respuesta?.messages?.[0]?.id || null;

  // ── Dejarlo en el mismo hilo que lo que manda el bot ──────────────────────
  // Si esto falla, el mensaje YA salió: no se devuelve error, solo se avisa.
  const { error: logErr } = await admin.rpc('wa_log_message', {
    p_tenant_id: tenantId,
    p_phone: destino,
    p_direction: 'outbound',
    p_content: template_name ? `[plantilla: ${template_name}]` : text!.trim(),
    p_wa_message_id: wamid,
    p_sent_by: 'humano',
    p_message_type: template_name ? 'template' : 'text',
    p_template_name: template_name || null,
    p_campaign: campaign || null,
    p_contact_name: null,
    p_metadata: { enviado_por: user.id },
  });

  return json({ ok: true, wa_message_id: wamid, registrado: !logErr });
});
