// Edge Function: POST /functions/v1/notifications-dispatch
// Despacha los `notification_jobs` vencidos: recordatorios de cita y recibos.
//
// POR QUÉ EXISTE
// Este despacho vivía en un workflow de n8n que apunta al proyecto Supabase
// ANTERIOR (onwgfixvbyknotnbrkgr), muerto desde la migración de infraestructura.
// Por eso los recordatorios y recibos que promete la landing nunca salían.
// Esta función lo hace dentro de Supabase, sin depender de n8n.
//
// Canales:
//   • email    → Resend, vía la función send-email (plantillas de _shared/emails.ts)
//   • whatsapp → Evolution API
// Si el paciente no tiene teléfono pero sí correo (o al revés), cae al canal disponible.
//
// Auth: Bearer service_role (lo llama el cron). Nadie más puede dispararlo.
//
// Secretos: SUPABASE_SERVICE_ROLE_KEY, EVOLUTION_BASE_URL, EVOLUTION_API_KEY,
//           EVOLUTION_INSTANCE_NAME, CLINIC_NAME  (+ RESEND_API_KEY en send-email)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EVOLUTION_BASE_URL = Deno.env.get('EVOLUTION_BASE_URL') || '';
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY') || '';
const EVOLUTION_INSTANCE = Deno.env.get('EVOLUTION_INSTANCE_NAME') || '';
const CLINIC_NAME = Deno.env.get('CLINIC_NAME') || 'chiropract.co';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });

/** template_key del job -> plantilla de correo de _shared/emails.ts */
const EMAIL_TEMPLATE: Record<string, string> = {
  reminder_24h: 'appointment_reminder',
  reminder_2h: 'appointment_reminder',
  post_appointment_receipt: 'receipt',
  appointment_confirmation: 'appointment_confirmation',
};

/** Mensaje de WhatsApp por tipo de job. */
function whatsappText(job: any, patientName: string): string {
  const first = (patientName || '').split(' ')[0] || '';
  const p = job.payload || {};
  const hola = first ? `Hola ${first} 👋\n\n` : '';
  switch (job.template_key) {
    case 'reminder_24h':
      return `${hola}Te recordamos tu cita en *${CLINIC_NAME}* mañana ${p.date || ''} a las ${p.time || ''}.\n\nSi no puedes asistir, avísanos por aquí.`;
    case 'reminder_2h':
      return `${hola}Tu cita en *${CLINIC_NAME}* es hoy a las ${p.time || ''}. ¡Te esperamos!`;
    case 'post_appointment_receipt':
      return `${hola}Gracias por tu visita a *${CLINIC_NAME}*.\n\nTotal: ${p.sale_total || ''}\n${p.items_summary || ''}` +
             (p.receipt_url ? `\n\nTu recibo: ${p.receipt_url}` : '');
    default:
      return `${hola}Tienes una novedad en *${CLINIC_NAME}*.`;
  }
}

async function sendWhatsApp(phone: string, text: string) {
  if (!EVOLUTION_BASE_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return { ok: false, error: 'Evolution API no configurada' };
  }
  const res = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
    method: 'POST',
    headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ number: phone, text }),
  });
  if (!res.ok) return { ok: false, error: `Evolution ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}

async function sendEmail(type: string, to: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, to, data }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: `send-email ${res.status}: ${JSON.stringify(body).slice(0, 200)}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Solo el cron / backend. Se acepta el secreto dedicado del cron (CRON_SECRET,
  // de menor privilegio) o la service_role. Se usa CRON_SECRET porque el formato
  // de la llave de servicio cambió (JWT legacy vs sb_secret_) y comparar contra
  // el env daba falsos 401.
  const auth = req.headers.get('Authorization') || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') || '';
  const authorized = (CRON_SECRET && bearer === CRON_SECRET) || (SERVICE_ROLE && bearer === SERVICE_ROLE);
  if (!authorized) return json({ error: 'No autorizado' }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Reclama atómicamente los jobs vencidos (FOR UPDATE SKIP LOCKED en la RPC),
  // así dos ejecuciones simultáneas del cron nunca envían lo mismo dos veces.
  const { data: jobs, error: claimErr } = await supabase.rpc('notification_jobs_due', { p_limit: 50 });
  if (claimErr) {
    console.error('notification_jobs_due', claimErr);
    return json({ error: 'No se pudieron reclamar los jobs' }, 500);
  }
  if (!jobs || jobs.length === 0) return json({ ok: true, processed: 0 });

  let sent = 0, failed = 0;

  for (const job of jobs) {
    try {
      // Datos de contacto del paciente
      let phone: string | null = job.recipient_phone || null;
      let email: string | null = null;
      let name = '';
      if (job.patient_id) {
        const { data: p } = await supabase
          .from('patients').select('full_name, phone, email').eq('id', job.patient_id).maybeSingle();
        name = p?.full_name || '';
        phone = phone || p?.phone || null;
        email = p?.email || null;
      }

      const wantsEmail = job.channel === 'email';
      let result: { ok: boolean; error?: string } = { ok: false, error: 'sin destinatario' };

      if (wantsEmail || (!phone && email)) {
        const tpl = EMAIL_TEMPLATE[job.template_key] || 'appointment_reminder';
        if (email) {
          result = await sendEmail(tpl, email, {
            first_name: name.split(' ')[0] || '',
            clinic_name: CLINIC_NAME,
            ...(job.payload || {}),
          });
        }
      } else if (phone) {
        result = await sendWhatsApp(phone.replace(/\D/g, ''), whatsappText(job, name));
      }

      if (result.ok) {
        await supabase.from('notification_jobs')
          .update({ status: 'sent', sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', job.id);
        sent++;
      } else {
        // Devolver a 'scheduled' para que el próximo ciclo reintente (attempts < 5).
        await supabase.from('notification_jobs')
          .update({
            status: 'scheduled',
            attempts: (job.attempts || 0) + 1,
            last_error: (result.error || 'error desconocido').slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq('id', job.id);
        failed++;
      }
    } catch (e) {
      console.error('job', job.id, e);
      await supabase.from('notification_jobs')
        .update({
          status: 'scheduled',
          attempts: (job.attempts || 0) + 1,
          last_error: String(e).slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      failed++;
    }
  }

  return json({ ok: true, processed: jobs.length, sent, failed });
});
