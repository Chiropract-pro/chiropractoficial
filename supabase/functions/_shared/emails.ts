// ============================================================
// _shared/emails.ts — Registro central de plantillas de correo de chiropract.co
//
// Cada plantilla es una función pura (data) => { subject, html }.
// La función send-email las renderiza y las envía con Resend.
// Mantener TODO el HTML de correos aquí para tener una sola fuente de verdad.
// ============================================================

const BRAND = {
  name: 'chiropract.co',
  primary: '#005c55',
  primaryDark: '#00413c',
  ink: '#131b2e',
  soft: '#3e4947',
  bg: '#faf8ff',
  card: '#ffffff',
  border: '#eaedff',
  site: (Deno.env.get('PUBLIC_SITE_URL') || 'https://chiropract.co').replace(/\/$/, ''),
};

function esc(s: unknown): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function button(label: string, href: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;
    text-decoration:none;font-weight:700;font-size:15px;padding:13px 28px;border-radius:12px;">${esc(label)}</a>`;
}

// Layout responsivo, compatible con la mayoría de clientes de correo (tablas + estilos inline).
function layout(opts: { title: string; preheader?: string; body: string; footerNote?: string }): string {
  const { title, preheader = '', body, footerNote } = opts;
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
      <tr><td style="padding:0 8px 20px;">
        <span style="font-size:20px;font-weight:800;color:${BRAND.primary};letter-spacing:-0.5px;">chiropract<span style="color:${BRAND.ink};">.co</span></span>
      </td></tr>
      <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:20px;padding:36px 32px;">
        ${body}
      </td></tr>
      <tr><td style="padding:20px 8px 0;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:${BRAND.soft};line-height:1.6;">
          ${footerNote ? esc(footerNote) + '<br>' : ''}
          Enviado por chiropract.co — la plataforma de los quiroprácticos de Latinoamérica.
        </p>
        <p style="margin:0;font-size:11px;color:#9aa3a1;">
          <a href="${BRAND.site}" style="color:#9aa3a1;">chiropract.co</a> ·
          <a href="${BRAND.site}/#privacy" style="color:#9aa3a1;">Privacidad</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function h1(text: string) { return `<h1 style="margin:0 0 12px;font-size:22px;color:${BRAND.ink};font-weight:800;">${esc(text)}</h1>`; }
function p(text: string) { return `<p style="margin:0 0 16px;font-size:15px;color:${BRAND.soft};line-height:1.65;">${text}</p>`; }
function spacer(h = 8) { return `<div style="height:${h}px;line-height:${h}px;">&nbsp;</div>`; }

export type EmailTemplate = { subject: string; html: string };

// ============================================================
// PLANTILLAS
// ============================================================
export const templates: Record<string, (d: Record<string, unknown>) => EmailTemplate> = {

  // --- Onboarding médico ---
  welcome: (d) => ({
    subject: `Bienvenido a chiropract.co, ${d.first_name || 'doctor'} 🦴`,
    html: layout({
      title: 'Bienvenido a chiropract.co',
      preheader: 'Tu consultorio digital está listo. Da el primer paso.',
      body:
        h1(`Bienvenido, ${esc(d.title || 'Dr.')} ${esc(d.first_name || '')}`) +
        p('Tu cuenta en <strong>chiropract.co</strong> está lista. Desde hoy puedes gestionar tu agenda, historia clínica, pagos y facturación en un solo lugar — y ser parte de la red profesional de quiroprácticos de Latinoamérica.') +
        p('Para empezar, completa tu <strong>perfil público</strong> y aparece en el directorio de médicos:') +
        spacer(8) + button('Completar mi perfil', `${BRAND.site}/#crm`) + spacer(16) +
        p('Si tienes dudas, responde a este correo. Estamos para ayudarte.'),
    }),
  }),

  // --- Perfil verificado por el equipo ---
  profile_verified: (d) => ({
    subject: '✅ Tu perfil en chiropract.co fue verificado',
    html: layout({
      title: 'Perfil verificado',
      preheader: 'Ya tienes la insignia azul y puedes publicar en la comunidad.',
      body:
        h1('¡Tu perfil está verificado!') +
        p(`Felicitaciones, ${esc(d.title || 'Dr.')} ${esc(d.first_name || '')}. El equipo de chiropract.co revisó tu perfil y ahora tienes la <strong>insignia azul de verificación</strong>.`) +
        p('Esto significa que ya puedes <strong>publicar, comentar y dar like</strong> en la comunidad, y que los pacientes ven tu perfil como verificado en el directorio.') +
        spacer(8) + button('Ver mi perfil', `${BRAND.site}/#dr/${esc(d.slug || '')}`) + spacer(8),
    }),
  }),

  // --- Invitación a unirse a un consultorio (equipo) ---
  team_invite: (d) => ({
    subject: `${d.inviter_name || 'Un colega'} te invitó a su consultorio en chiropract.co`,
    html: layout({
      title: 'Invitación a un consultorio',
      preheader: `Únete al equipo de ${d.tenant_name || 'un consultorio'} en chiropract.co.`,
      body:
        h1('Te invitaron a un consultorio') +
        p(`<strong>${esc(d.inviter_name || 'Un colega')}</strong> te invitó a unirte a <strong>${esc(d.tenant_name || 'su consultorio')}</strong> en chiropract.co como <strong>${esc(d.role || 'miembro')}</strong>.`) +
        p('Crea tu cuenta (o inicia sesión con este mismo correo) y acepta la invitación desde el panel:') +
        spacer(8) + button('Aceptar invitación', `${BRAND.site}/#crm`) + spacer(16) +
        p(`Esta invitación fue enviada a <strong>${esc(d.email || '')}</strong>. Si no la esperabas, puedes ignorar este correo.`),
      footerNote: 'Recibiste este correo porque te invitaron a un consultorio.',
    }),
  }),

  // --- Invitación al directorio / red (Fase D — outreach a quiroprácticos) ---
  directory_invite: (d) => ({
    subject: `${d.first_name ? d.first_name + ', ' : ''}te invitamos a la red de quiroprácticos de Latinoamérica`,
    html: layout({
      title: 'Invitación a chiropract.co',
      preheader: 'Un espacio profesional para quiroprácticos: directorio + comunidad + software.',
      body:
        h1(`Hola${d.first_name ? ', ' + esc(d.first_name) : ''} 👋`) +
        p('Estamos construyendo <strong>chiropract.co</strong>, la primera plataforma que reúne a los quiroprácticos de Latinoamérica: un <strong>directorio profesional</strong> donde los pacientes te encuentran, una <strong>comunidad</strong> para compartir casos y técnicas, y un <strong>software</strong> para gestionar tu consultorio.') +
        p('Nos encantaría que fueras de los primeros. Crear tu perfil es gratis y toma 2 minutos:') +
        spacer(8) + button('Crear mi perfil gratis', `${BRAND.site}/#crm`) + spacer(16) +
        p('Si prefieres no recibir estos correos, ' +
          `<a href="${BRAND.site}/#baja?e=${encodeURIComponent(String(d.email || ''))}" style="color:${BRAND.soft};">haz clic aquí para darte de baja</a>.`),
      footerNote: 'Recibes este correo como profesional de la quiropraxia. Puedes darte de baja cuando quieras.',
    }),
  }),

  // --- Confirmación de cita (paciente) ---
  appointment_confirmation: (d) => ({
    subject: `Tu cita en ${d.clinic_name || 'chiropract.co'} está confirmada`,
    html: layout({
      title: 'Cita confirmada',
      preheader: `${d.date || ''} — ${d.clinic_name || ''}`,
      body:
        h1('Tu cita está confirmada ✅') +
        p(`Hola ${esc(d.patient_name || '')}, tu cita quedó agendada:`) +
        `<div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:14px;color:${BRAND.ink};"><strong>📅 ${esc(d.date || '')}</strong></p>
          <p style="margin:0 0 6px;font-size:14px;color:${BRAND.soft};">👨‍⚕️ ${esc(d.doctor_name || '')}</p>
          ${d.address ? `<p style="margin:0;font-size:14px;color:${BRAND.soft};">📍 ${esc(d.address)}</p>` : ''}
        </div>` +
        (d.whatsapp ? p(`¿Necesitas reprogramar? Escríbenos por WhatsApp al ${esc(d.whatsapp)}.`) : ''),
    }),
  }),

  // --- Recordatorio de cita (paciente) ---
  appointment_reminder: (d) => ({
    subject: `Recordatorio: tu cita es ${d.when || 'pronto'}`,
    html: layout({
      title: 'Recordatorio de cita',
      preheader: `${d.date || ''} — ${d.clinic_name || ''}`,
      body:
        h1('Te esperamos 👋') +
        p(`Hola ${esc(d.patient_name || '')}, te recordamos tu cita <strong>${esc(d.when || '')}</strong>:`) +
        `<div style="background:${BRAND.bg};border:1px solid ${BRAND.border};border-radius:12px;padding:16px 18px;margin:0 0 16px;">
          <p style="margin:0 0 6px;font-size:14px;color:${BRAND.ink};"><strong>📅 ${esc(d.date || '')}</strong></p>
          <p style="margin:0;font-size:14px;color:${BRAND.soft};">👨‍⚕️ ${esc(d.doctor_name || '')}</p>
        </div>` +
        p('Si no puedes asistir, avísanos con anticipación.'),
    }),
  }),

  // --- Recibo / comprobante de pago (paciente) ---
  receipt: (d) => ({
    subject: `Tu recibo de ${d.clinic_name || 'chiropract.co'}`,
    html: layout({
      title: 'Recibo de servicio',
      preheader: `Comprobante por ${d.total || ''}`,
      body:
        h1('Gracias por tu pago 🙏') +
        p(`Hola ${esc(d.patient_name || '')}, recibimos tu pago de <strong>${esc(d.total || '')}</strong>. Puedes ver y descargar tu recibo aquí:`) +
        spacer(8) + button('Ver recibo', String(d.receipt_url || `${BRAND.site}`)) + spacer(8),
    }),
  }),

  // --- Suscripción SaaS: prueba por terminar ---
  trial_ending: (d) => ({
    subject: `Tu prueba de chiropract.co termina en ${d.days_left || 'pocos'} días`,
    html: layout({
      title: 'Tu prueba está por terminar',
      preheader: 'Elige un plan y no pierdas el acceso a tu consultorio.',
      body:
        h1(`Quedan ${esc(d.days_left || 'pocos')} días de prueba`) +
        p(`Hola ${esc(d.first_name || '')}, tu prueba gratuita de chiropract.co está por terminar. Para seguir usando tu agenda, historia clínica y facturación sin interrupciones, elige un plan:`) +
        spacer(8) + button('Ver planes', `${BRAND.site}/#crm`) + spacer(8),
    }),
  }),

  // --- Suscripción SaaS: pago exitoso ---
  subscription_success: (d) => ({
    subject: 'Pago recibido — tu plan de chiropract.co está activo',
    html: layout({
      title: 'Pago recibido',
      preheader: 'Tu suscripción está activa. ¡Gracias!',
      body:
        h1('¡Gracias por tu pago! ✅') +
        p(`Tu plan <strong>${esc(d.plan_name || '')}</strong> quedó activo${d.next_billing ? ` hasta el <strong>${esc(d.next_billing)}</strong>` : ''}. Sigue gestionando tu consultorio sin límites.`) +
        spacer(8) + button('Ir a mi consultorio', `${BRAND.site}/#crm`) + spacer(8),
    }),
  }),

  // --- Suscripción SaaS: pago fallido ---
  subscription_failed: (d) => ({
    subject: '⚠️ No pudimos procesar tu pago de chiropract.co',
    html: layout({
      title: 'Problema con tu pago',
      preheader: 'Actualiza tu método de pago para no perder el acceso.',
      body:
        h1('No pudimos procesar tu pago') +
        p(`Hola ${esc(d.first_name || '')}, tuvimos un problema al cobrar tu plan <strong>${esc(d.plan_name || '')}</strong>. Para no perder el acceso a tu consultorio, actualiza tu método de pago:`) +
        spacer(8) + button('Actualizar pago', `${BRAND.site}/#crm`) + spacer(8),
    }),
  }),
};

export function renderTemplate(type: string, data: Record<string, unknown>): EmailTemplate {
  const fn = templates[type];
  if (!fn) throw new Error(`Plantilla de correo desconocida: ${type}`);
  return fn(data || {});
}
