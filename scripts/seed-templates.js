// Siembra plantillas de mensajes WhatsApp en notification_templates.
// Uso: node --env-file=.env scripts/seed-templates.js
//
// Variables disponibles entre {{...}}:
//   {{patient_name}} {{patient_first_name}} {{appointment_date}} {{appointment_time}}
//   {{appointment_type}} {{location}} {{doctor_name}} {{clinic_name}}
//   {{jornada_city}} {{jornada_date}} {{available_slots}}
//   {{receipt_url}} {{payment_url}} {{calendar_url}}
//   {{sale_total}} {{items_summary}}

import { pool } from './_db.js';

const TENANT_SLUG = process.argv[2] || 'quiropraxia-diaz';

const TEMPLATES = [
  {
    key: 'reminder_24h',
    description: 'Recordatorio enviado 24 horas antes de la cita.',
    body: `Hola {{patient_first_name}}, le saluda el equipo de chiropract.co.

Le recordamos que mañana *{{appointment_date}}* a las *{{appointment_time}}* tiene su {{appointment_type}} con el Dr. Miguel Ángel Díaz en {{location}}.

¿Confirma su asistencia? Responda:
✅ *Sí* — para confirmar
🔄 *Reagendar* — para mover su cita
❌ *Cancelar* — si no podrá asistir

Cualquier duda, escríbanos por aquí mismo. Estamos para servirle.`,
    variables: ['patient_first_name', 'appointment_date', 'appointment_time', 'appointment_type', 'location'],
  },
  {
    key: 'reminder_2h',
    description: 'Recordatorio enviado 2 horas antes de la cita.',
    body: `{{patient_first_name}}, le recordamos que en 2 horas lo esperamos para su {{appointment_type}} con el Dr. Miguel Ángel.

📍 {{location}}
🕐 {{appointment_time}}

Si tiene algún imprevisto, avísenos por aquí. — Equipo chiropract.co`,
    variables: ['patient_first_name', 'appointment_type', 'location', 'appointment_time'],
  },
  {
    key: 'appointment_confirmed',
    description: 'Confirmación de cita recién agendada.',
    body: `Listo {{patient_first_name}}, su cita quedó confirmada:

📅 {{appointment_date}}
🕐 {{appointment_time}}
📍 {{location}}
👨‍⚕️ Dr. Miguel Ángel Díaz

Le enviaremos un recordatorio el día antes. Si necesita reagendar, escríbanos por aquí.

— Equipo chiropract.co`,
    variables: ['patient_first_name', 'appointment_date', 'appointment_time', 'location'],
  },
  {
    key: 'appointment_cancelled',
    description: 'Confirmación de cita cancelada.',
    body: `{{patient_first_name}}, su cita del {{appointment_date}} a las {{appointment_time}} fue cancelada.

Cuando quiera reprogramarla, solo escríbanos por aquí o llámenos. El cuidado de su columna no tiene que esperar mucho.

— Equipo chiropract.co`,
    variables: ['patient_first_name', 'appointment_date', 'appointment_time'],
  },
  {
    key: 'post_appointment_receipt',
    description: 'Mensaje post-cita con recibo y próximos pasos.',
    body: `Gracias por su visita de hoy, {{patient_first_name}}.

Le compartimos:
🧾 *Recibo de su sesión:* {{receipt_url}}
💰 Total: {{sale_total}}
📋 {{items_summary}}

Para que el ajuste rinda mejor, recuerde:
• Tomar abundante agua hoy
• Evitar esfuerzos físicos las próximas 24h
• Aplicar calor local si siente molestia

Cualquier duda durante esta semana, escríbanos. Estamos pendientes de su evolución.

— Equipo chiropract.co`,
    variables: ['patient_first_name', 'receipt_url', 'sale_total', 'items_summary'],
  },
  {
    key: 'jornada_announcement',
    description: 'Anuncio de jornada próxima a pacientes de ese municipio.',
    body: `{{patient_first_name}}, el Dr. Miguel Ángel estará en *{{jornada_city}}* el {{jornada_date}}.

Quedan {{available_slots}} cupos disponibles. Como ya lo conocemos, le apartamos uno si nos confirma por aquí antes del jueves.

¿Le reservamos su cita?

— Equipo chiropract.co`,
    variables: ['patient_first_name', 'jornada_city', 'jornada_date', 'available_slots'],
  },
  {
    key: 'payment_link',
    description: 'Link de pago en línea (Wompi).',
    body: `{{patient_first_name}}, aquí le compartimos el link para pagar su {{appointment_type}}:

💳 {{payment_url}}

Total: {{sale_total}}

Una vez confirmado el pago, le enviaremos su recibo por aquí mismo.

— Equipo chiropract.co`,
    variables: ['patient_first_name', 'appointment_type', 'payment_url', 'sale_total'],
  },
  {
    key: 'human_handoff',
    description: 'Mensaje cuando el bot escala a un humano.',
    body: `{{patient_first_name}}, en un momento alguien del equipo le responde personalmente. Gracias por su paciencia.

Si es una emergencia, llámenos directamente.

— Equipo chiropract.co`,
    variables: ['patient_first_name'],
  },
  {
    key: 'welcome_new_patient',
    description: 'Bienvenida tras primera consulta.',
    body: `Bienvenido a chiropract.co, {{patient_first_name}}.

Acaba de conocer al Dr. Miguel Ángel Díaz, especialista en cuidado espinal integral — el método que combina quiropraxia, ortopedia y fisioterapia en un solo plan de tratamiento.

A partir de ahora, este chat es su canal directo con el equipo. Aquí puede:
📅 Ver y reagendar sus citas
🧾 Descargar sus recibos
💬 Hacer preguntas sobre su tratamiento
📍 Enterarse de las jornadas en su municipio

Cuando quiera. Estamos para servirle.`,
    variables: ['patient_first_name'],
  },
];

async function run() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT id, name FROM tenants WHERE slug = $1`, [TENANT_SLUG]);
    if (rows.length === 0) {
      console.error(`❌ Tenant "${TENANT_SLUG}" no encontrado`);
      process.exit(1);
    }
    const tenant = rows[0];
    console.log(`Sembrando plantillas para: ${tenant.name}\n`);

    for (const t of TEMPLATES) {
      await client.query(
        `INSERT INTO notification_templates (tenant_id, key, channel, body, description, variables)
         VALUES ($1, $2, 'whatsapp', $3, $4, $5)
         ON CONFLICT (tenant_id, key, channel)
         DO UPDATE SET body = EXCLUDED.body, description = EXCLUDED.description, variables = EXCLUDED.variables, version = notification_templates.version + 1`,
        [tenant.id, t.key, t.body, t.description, JSON.stringify(t.variables)]
      );
      console.log(`  ✅ ${t.key}`);
    }

    console.log(`\n✅ ${TEMPLATES.length} plantillas sembradas.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
