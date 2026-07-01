// Updates:
// 1. Cron workflow: usar recipient_phone si existe (notificar al doctor, no al paciente)
// 2. Bot top-tier: nuevo tool consultar_doctores, agendar_cita_pendiente acepta doctor_id

const N = process.env.N8N_BASE_URL;
const T = process.env.N8N_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVO_BASE = process.env.EVOLUTION_BASE_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_NAME = 'Miguel Angel Diaz Quiropractico';
const EVO_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;
const OPENAI_CRED_ID = 'XlxKrDQAS1w750sv';
const OPENAI_CRED_NAME = 'OpenAi account';
const PG_CRED_ID = 'TWsCSq6GjZihPtkS';
const BOT_WF_ID = '894oc1X7Z8iuK9H5';
const CRON_WF_ID = 'JO9JQseyInqTvvin';

// ============================================
// PARTE 1: Update CRON workflow para soportar recipient_phone
// ============================================
async function updateCronWorkflow() {
  console.log('\n=== UPDATE CRON WORKFLOW ===');
  const r = await fetch(N + '/api/v1/workflows/' + CRON_WF_ID, { headers: { 'X-N8N-API-KEY': T } });
  const wf = await r.json();

  // El "Renderizar mensaje" code: cambiar para usar job.recipient_phone si existe
  const renderNode = wf.nodes.find(n => n.id === 'render-message');
  if (!renderNode) {
    console.log('  ⚠ No se encontró nodo render-message; reescribo workflow completo del cron');
    return false;
  }

  renderNode.parameters.jsCode = `// Renderiza la plantilla. Si el job tiene recipient_phone, ese es el destinatario.
const job = $('Split jobs').item.json;
const template = $('Obtener plantilla').item.json[0];
const patient = $('Obtener paciente').item.json[0];

if (!template) {
  return [{ json: { skip: true, reason: 'template missing', job_id: job.id } }];
}

// Determinar destinatario
let phone = '';
if (job.recipient_phone) {
  phone = String(job.recipient_phone).replace(/\\D/g, '');
} else if (patient && patient.phone) {
  phone = String(patient.phone).replace(/\\D/g, '');
}

if (!phone) {
  return [{ json: { skip: true, reason: 'no phone', job_id: job.id } }];
}

const payload = job.payload || {};
const patientName = patient?.full_name || payload.patient_name || '';
const firstName = patientName.split(' ')[0] || 'Hola';

const vars = {
  patient_name: patientName,
  patient_first_name: firstName,
  appointment_date: payload.date || payload.appointment_date || '',
  appointment_time: payload.time || payload.appointment_time || '',
  appointment_type: payload.type || payload.appointment_type || 'consulta',
  type_label: payload.type_label || '',
  location: payload.location || 'consultorio',
  doctor_name: 'Dr. Miguel Ángel Díaz',
  doctor_first_name: payload.doctor_first_name || 'Doctor',
  clinic_name: 'chiropract.co',
  jornada_city: payload.city || '',
  jornada_date: payload.jornada_date || '',
  available_slots: payload.available_slots || '',
  receipt_url: payload.receipt_url || '',
  payment_url: payload.payment_url || '',
  sale_total: payload.sale_total || '',
  items_summary: payload.items_summary || '',
};

let body = template.body;
for (const [k, v] of Object.entries(vars)) {
  body = body.replaceAll('{{' + k + '}}', String(v));
}

return [{
  json: {
    job_id: job.id,
    tenant_id: job.tenant_id,
    patient_id: job.patient_id,
    appointment_id: job.appointment_id,
    phone,
    rendered_body: body,
    template_key: job.template_key,
  }
}];`;

  delete wf.id; delete wf.active; delete wf.createdAt; delete wf.updatedAt; delete wf.staticData; delete wf.tags;
  const r2 = await fetch(N + '/api/v1/workflows/' + CRON_WF_ID, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: wf.settings || { executionOrder: 'v1' } }),
  });
  console.log('  PUT cron:', r2.status);
  if (!r2.ok) { console.log(await r2.text()); return false; }
  await fetch(N + '/api/v1/workflows/' + CRON_WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('  ✅ Cron actualizado para usar recipient_phone');
  return true;
}

// ============================================
// PARTE 2: Update BOT top-tier — añadir tool consultar_doctores + agendar con doctor
// ============================================
const SYSTEM_MSG = `Eres el asistente virtual top-tier del equipo de chiropract.co, la clínica del Dr. Miguel Ángel Díaz y la Dra. July Blanco.

═══════════════════════════════════════════════════
CONTEXTO TEMPORAL (CRÍTICO — leer primero)
═══════════════════════════════════════════════════
HOY ES: {{ $now.format('cccc, dd \\'de\\' LLLL \\'de\\' yyyy') }}
HORA ACTUAL: {{ $now.format('HH:mm') }} (zona America/Bogota)
AÑO: {{ $now.format('yyyy') }}

REGLAS DURAS DE FECHAS:
1. SIEMPRE usa el AÑO ACTUAL ({{ $now.format('yyyy') }}).
2. NUNCA agendes fechas pasadas.
3. NUNCA uses 2024 o 2025.
4. Antes de agendar, verifica que la fecha sea FUTURA.

═══════════════════════════════════════════════════
EQUIPO MÉDICO
═══════════════════════════════════════════════════
La clínica tiene 2 profesionales:
- **Dr. Miguel Ángel Díaz** — quiropraxia, ortopedia, fisioterapia integradas. 15+ años.
- **Dra. July Blanco** — esposa del Dr. Miguel, también especialista del consultorio.

Cuando alguien quiera agendar, SIEMPRE pregunta con cuál de los dos prefiere su consulta
(salvo que el paciente ya lo mencione). Usa la tool consultar_doctores para obtener IDs reales.

═══════════════════════════════════════════════════
IDENTIDAD
═══════════════════════════════════════════════════
Te identificas como "el equipo de chiropract.co".
NUNCA te haces pasar por ningún doctor personalmente.
Filosofía: "Tu columna no debería esperar a que llegues a la capital."
Atendemos en consultorio (Bogotá) y jornadas itinerantes en: Soatá, Guamal, Muzo, Garcés Navas.

═══════════════════════════════════════════════════
TONO
═══════════════════════════════════════════════════
- TRATO: usted (Colombia, mucho adulto mayor).
- ESTILO: cálido, profesional, cercano.
- 1-3 párrafos máximo. Es WhatsApp.
- Emojis moderados: 📅 🕐 📍 🧾 💳 ✅ ❌ 🔄.
- Saludo según hora: "Buenos días" (5-12), "Buenas tardes" (12-18), "Buenas noches" (18-5).

═══════════════════════════════════════════════════
HERRAMIENTAS DISPONIBLES
═══════════════════════════════════════════════════

🔍 reconocer_paciente — OBLIGATORIO al iniciar conversación.

👨‍⚕️👩‍⚕️ consultar_doctores — Lista los doctores activos del consultorio con sus IDs.
   Llamar ANTES de agendar para saber el doctor_id correcto.

📅 consultar_proxima_cita — Próximas citas del paciente (incluye nombre del doctor asignado).

🗓 consultar_jornadas — Próximas jornadas con cupos.

💰 consultar_servicios — Catálogo de servicios y precios.

✏️ agendar_cita_pendiente — Crea cita PENDIENTE con doctor asignado.
   Requiere: patient_id, doctor_id, fecha, hora, tipo.
   Si el paciente no especifica doctor, pregunta "¿prefiere con el Dr. Miguel o la Dra. July?".

🔄 solicitar_reagendar — Cuando piden cambiar fecha.

❌ solicitar_cancelar — Cuando quieren cancelar.

🧾 consultar_recibos — Lista últimos 5 recibos.

📝 registrar_lead — Si NO es paciente registrado.

🚨 escalar_a_humano — Para emergencias / quejas / pedido directo.

═══════════════════════════════════════════════════
FLUJO DE AGENDAMIENTO (CRÍTICO)
═══════════════════════════════════════════════════

1. reconocer_paciente (con teléfono actual del usuario)
2. Si NO es paciente → ofrecer registrar_lead, NO intentar agendar todavía
3. Si SÍ es paciente:
   a. consultar_doctores (para obtener IDs)
   b. Preguntar al usuario:
      - "¿Prefiere agendar con el Dr. Miguel o con la Dra. July?"
      - Si responde "el doctor" / "Miguel" → doctor_id = Dr. Miguel
      - Si responde "la doctora" / "July" → doctor_id = Dra. July
      - Si dice "el que sea" → asigna al primero disponible
   c. Preguntar: tipo (primera_consulta o seguimiento), fecha tentativa, hora preferida
   d. Llamar agendar_cita_pendiente con TODOS los parámetros, incluyendo doctor_id
   e. La cita queda PENDIENTE — el doctor recibe automáticamente notificación WhatsApp
   f. Confirmar al paciente: "Listo {{nombre}}, su cita con {{Dr/a Nombre}} quedó pre-agendada
      para el {{fecha}} a las {{hora}}. El equipo le confirma en breve."

NUNCA confirmes un horario sin antes haber llamado a agendar_cita_pendiente.
NUNCA inventes doctor_id — siempre obténlo de consultar_doctores.

═══════════════════════════════════════════════════
LÍMITES DUROS
═══════════════════════════════════════════════════
- NUNCA diagnosticas.
- NUNCA recetas medicamentos.
- NUNCA inventas precios, fechas, datos.
- NUNCA compartas datos de otros pacientes.

═══════════════════════════════════════════════════
ESCALACIÓN
═══════════════════════════════════════════════════
Emergencias ("no puedo moverme", "dolor 10/10", "ambulancia") → escalar_a_humano urgency=urgent + mencionar línea 123.
Quejas o frustración → escalar_a_humano urgency=high.
Pide hablar con persona → escalar_a_humano urgency=normal.

═══════════════════════════════════════════════════
FIRMA
═══════════════════════════════════════════════════
Termina cada mensaje sustancial con: "— Equipo chiropract.co"`;

const SUPA_HEADERS_BLOCK = `headers: {
      apikey: '${SERVICE_ROLE}',
      Authorization: 'Bearer ${SERVICE_ROLE}',
      'Content-Type': 'application/json',
    }`;

const TOOLS = [
  {
    id: 'tool-recognize',
    name: 'reconocer_paciente',
    description: 'OBLIGATORIO al iniciar conversación. Busca al paciente por teléfono. Devuelve patient_id, full_name, status, total_visits. Vacío = lead nuevo.',
    rpc: 'bot_recognize_patient',
    params: `{ p_phone: input.Telefono || '' }`,
  },
  {
    id: 'tool-doctors',
    name: 'consultar_doctores',
    description: 'Lista los doctores del consultorio con sus IDs. LLAMAR ANTES de agendar para conseguir doctor_id real. Devuelve array con doctor_id, full_name, role, phone.',
    rpc: 'bot_list_doctors',
    params: `{ p_tenant_id: input.tenant_id }`,
  },
  {
    id: 'tool-upcoming-appts',
    name: 'consultar_proxima_cita',
    description: 'Próximas 3 citas del paciente con nombre del doctor asignado. Útil cuando preguntan por su cita.',
    rpc: 'bot_upcoming_appointments',
    params: `{ p_phone: input.Telefono || '', p_limit: 3 }`,
  },
  {
    id: 'tool-jornadas',
    name: 'consultar_jornadas',
    description: 'Próximas jornadas itinerantes con cupos. p_city opcional para filtrar.',
    rpc: 'bot_upcoming_jornadas',
    params: `{ p_tenant_id: input.tenant_id, p_city: input.city_filter || null, p_limit: 5 }`,
  },
  {
    id: 'tool-services',
    name: 'consultar_servicios',
    description: 'Catálogo de servicios con precios.',
    rpc: 'bot_active_services',
    params: `{ p_tenant_id: input.tenant_id }`,
  },
  {
    id: 'tool-appoint',
    name: 'agendar_cita_pendiente',
    description: 'Crea cita PENDIENTE con doctor asignado. Requiere patient_id, doctor_id (de consultar_doctores), fecha YYYY-MM-DD futura, hora HH:MM, tipo (primera_consulta|seguimiento|jornada|emergencia). El doctor recibe notificación WhatsApp automática.',
    rpc: 'bot_request_appointment',
    params: `{
      p_tenant_id: input.tenant_id,
      p_patient_id: input.patient_id,
      p_patient_name: input.patient_name || input.Nombre,
      p_date: input.fecha,
      p_time: input.hora,
      p_type: input.tipo || 'seguimiento',
      p_location: input.ubicacion || 'consultorio',
      p_notes: input.notas || null,
      p_doctor_id: input.doctor_id || null
    }`,
  },
  {
    id: 'tool-reschedule',
    name: 'solicitar_reagendar',
    description: 'Marca cita para reagendar. Necesita appointment_id.',
    rpc: 'bot_request_reschedule',
    params: `{ p_appointment_id: input.appointment_id, p_preferred_date: input.fecha_preferida || null, p_reason: input.motivo || null }`,
  },
  {
    id: 'tool-cancel',
    name: 'solicitar_cancelar',
    description: 'Cancela cita inmediatamente. Necesita appointment_id.',
    rpc: 'bot_cancel_appointment',
    params: `{ p_appointment_id: input.appointment_id, p_reason: input.motivo || null }`,
  },
  {
    id: 'tool-receipts',
    name: 'consultar_recibos',
    description: 'Últimos 5 recibos del paciente.',
    rpc: 'bot_get_recent_receipts',
    params: `{ p_phone: input.Telefono || '', p_limit: 5 }`,
  },
  {
    id: 'tool-lead',
    name: 'registrar_lead',
    description: 'Registra lead nuevo cuando NO es paciente registrado.',
    rpc: 'bot_register_lead',
    params: `{
      p_tenant_id: input.tenant_id,
      p_name: input.nombre || input.Nombre || 'Lead WhatsApp',
      p_phone: input.Telefono || '',
      p_city: input.ciudad || null,
      p_motivo: input.motivo || null
    }`,
  },
  {
    id: 'tool-escalate',
    name: 'escalar_a_humano',
    description: 'Crea alerta inmediata. urgency: urgent (emergencia), high (queja), normal.',
    rpc: 'bot_escalate_to_human',
    params: `{
      p_tenant_id: input.tenant_id,
      p_phone: input.Telefono || '',
      p_patient_name: input.Nombre || 'Paciente',
      p_reason: input.razon || 'Solicitud del paciente',
      p_urgency: input.urgency || 'normal'
    }`,
  },
];

async function updateBotWorkflow() {
  console.log('\n=== UPDATE BOT WORKFLOW ===');
  const r = await fetch(N + '/api/v1/workflows/' + BOT_WF_ID, { headers: { 'X-N8N-API-KEY': T } });
  const wf = await r.json();

  // Update agent system prompt
  const agent = wf.nodes.find(n => n.id === 'agent');
  if (agent) {
    agent.parameters.options.systemMessage = SYSTEM_MSG;
    console.log('  ✅ System prompt actualizado');
  }

  // Replace tools (drop old ones, add new)
  wf.nodes = wf.nodes.filter(n => n.type !== '@n8n/n8n-nodes-langchain.toolCode');
  TOOLS.forEach((t, i) => {
    wf.nodes.push({
      parameters: {
        name: t.name,
        description: t.description,
        jsCode: `
const input = $input.first().json;
const params = ${t.params};
try {
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: '${SUPABASE_URL}/rest/v1/rpc/${t.rpc}',
    ${SUPA_HEADERS_BLOCK},
    body: params,
    json: true,
  });
  return typeof r === 'string' ? r : JSON.stringify(r);
} catch (e) {
  return JSON.stringify({ error: e.message || 'tool failed' });
}
        `.trim(),
      },
      id: t.id,
      name: t.name,
      type: '@n8n/n8n-nodes-langchain.toolCode',
      typeVersion: 1,
      position: [1900 + (i % 4) * 220, 700 + Math.floor(i / 4) * 180],
    });
  });
  console.log(`  ✅ ${TOOLS.length} tools actualizadas`);

  // Connections — recrear las de tools
  TOOLS.forEach((t) => {
    wf.connections[t.name] = { ai_tool: [[{ node: 'chiropract Agent', type: 'ai_tool', index: 0 }]] };
  });

  delete wf.id; delete wf.active; delete wf.createdAt; delete wf.updatedAt; delete wf.staticData; delete wf.tags;
  const r2 = await fetch(N + '/api/v1/workflows/' + BOT_WF_ID, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' } }),
  });
  console.log('  PUT bot:', r2.status);
  if (!r2.ok) { console.log(await r2.text()); return false; }
  await fetch(N + '/api/v1/workflows/' + BOT_WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('  ✅ Bot top-tier actualizado con doctores');
  return true;
}

(async () => {
  await updateCronWorkflow();
  await updateBotWorkflow();
})();
