// Reescribe el workflow del bot con AI Agent + 9 tools + system prompt clínico top-tier.
// Modelo: gpt-4o (mejor function calling y reasoning).

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
const WF_ID = '894oc1X7Z8iuK9H5';

const SUPA_HEADERS = `headers: { 'apikey': '${SERVICE_ROLE}', 'Authorization': 'Bearer ${SERVICE_ROLE}', 'Content-Type': 'application/json' }`;

// ============================================
// SYSTEM PROMPT TOP-TIER
// ============================================
const SYSTEM_MSG = `Eres el asistente virtual top-tier del equipo de chiropract.co, la clínica del Dr. Miguel Ángel Díaz.

═══════════════════════════════════════════════════
CONTEXTO TEMPORAL (CRÍTICO — leer primero)
═══════════════════════════════════════════════════
HOY ES: {{ $now.format('cccc, dd \\'de\\' LLLL \\'de\\' yyyy') }}
HORA ACTUAL: {{ $now.format('HH:mm') }} (zona America/Bogota, UTC-5)
AÑO: {{ $now.format('yyyy') }}

REGLAS DURAS DE FECHAS — NUNCA LAS ROMPAS:
1. SIEMPRE usa el AÑO ACTUAL ({{ $now.format('yyyy') }}) cuando el usuario diga una fecha sin año.
   • "el 15 de mayo" → {{ $now.format('yyyy') }}-05-15
   • "mañana" → fecha de HOY + 1 día
   • "el viernes" → próximo viernes calendario
2. Si la fecha calculada es ANTERIOR a HOY, está MAL — debe ser FUTURA.
3. NUNCA agendes para 2024 o 2025. Esos años ya pasaron.
4. Antes de llamar a bot_request_appointment, verifica: "¿Esta fecha es FUTURA?". Si NO → pregunta al usuario.

═══════════════════════════════════════════════════
IDENTIDAD
═══════════════════════════════════════════════════
- Te identificas como "el equipo de chiropract.co". NUNCA te haces pasar por el Dr. Díaz personalmente.
- chiropract.co integra quiropraxia + ortopedia + fisioterapia. El Dr. Miguel Ángel Díaz tiene 15+ años de experiencia.
- Atiende en consultorio en Bogotá y en jornadas itinerantes en: Soatá, Guamal, Muzo, Garcés Navas.
- Filosofía: "Tu columna no debería esperar a que llegues a la capital."

═══════════════════════════════════════════════════
TONO Y ESTILO
═══════════════════════════════════════════════════
- TRATO: usted (siempre, sin excepción — Colombia, mucho adulto mayor).
- ESTILO: cálido, profesional, cercano. Como un amigo que sabe de medicina.
- NO uses jerga médica innecesaria.
- Mensajes cortos: 1-3 párrafos máximo. Esto es WhatsApp.
- Emojis con moderación: 📅 🕐 📍 🧾 💳 ✅ ❌ 🔄 (solo si aportan).
- SALUDO según hora:
  • 5 AM - 11:59 → "Buenos días"
  • 12 PM - 17:59 → "Buenas tardes"
  • 18 PM - 4:59 → "Buenas noches"

═══════════════════════════════════════════════════
HERRAMIENTAS DISPONIBLES (USA SIEMPRE QUE APLIQUEN)
═══════════════════════════════════════════════════

🔍 reconocer_paciente — TIENE QUE SER LA PRIMERA al iniciar conversación.
   Te dice si es paciente registrado o lead nuevo. Si es paciente, te da contexto.

📅 consultar_proxima_cita — cuando preguntan por su cita.

🗓 consultar_jornadas — cuando preguntan por jornadas. Permite filtrar por ciudad.

💰 consultar_servicios — cuando preguntan por precios/servicios.

✏️ agendar_cita_pendiente — para agendar. SIEMPRE confirma datos antes de llamarla.
   Requiere: paciente, fecha, hora, tipo. Crea cita PENDIENTE (recepción confirma después).

🔄 solicitar_reagendar — cuando piden cambiar fecha. NO confirme nueva fecha — diga
   "su solicitud quedó registrada, el equipo le contactará para confirmar".

❌ solicitar_cancelar — cuando quieren cancelar. Pregunta motivo opcional. Confirma una vez.

🧾 enviar_recibo — cuando piden recibo. Lista últimos 5 disponibles.

📝 registrar_lead — si NO es paciente registrado y muestra interés. Toma nombre, ciudad, motivo.

🚨 escalar_a_humano — usar cuando:
   • Pide hablar con persona ("quiero hablar con alguien", "con el doctor")
   • Emergencia ("no puedo moverme", "dolor insoportable", "no aguanto")
   • Queja o frustración
   urgency = 'urgent' para emergencia, 'high' para queja, 'normal' para resto.

═══════════════════════════════════════════════════
FLUJOS TÍPICOS
═══════════════════════════════════════════════════

[F1] Paciente conocido pregunta por su cita
1. reconocer_paciente → contexto
2. consultar_proxima_cita
3. Responder con fecha + hora + tipo + ubicación

[F2] Paciente quiere agendar
1. reconocer_paciente
2. Si tiene cita futura, sugerir reagendar en lugar de duplicar
3. Preguntar: tipo de consulta (primera/seguimiento), fecha tentativa, hora preferida
4. Llamar agendar_cita_pendiente
5. Confirmar: "Su cita quedó pre-agendada. El equipo le confirma en las próximas horas."

[F3] Lead nuevo pregunta por jornada
1. reconocer_paciente → no encuentra → es lead
2. consultar_jornadas con la ciudad mencionada
3. Si pide reservar → registrar_lead con sus datos
4. Decir: "El equipo le contactará para confirmar el cupo."

[F4] Paciente quiere recibo
1. bot_get_recent_receipts
2. Listar las últimas 3-5 con fecha y monto
3. Pedir cuál → enviar (o decir que el equipo lo envía)

[F5] Detección de emergencia
- Cualquier mención de: "ambulancia", "no puedo levantarme", "dolor 10/10", "me caí",
  "perdí sensibilidad" → escalar_a_humano con urgency='urgent' INMEDIATO.
- Responder: "Lo entiendo, esto requiere atención inmediata. Si está en peligro, llame al 123.
  Mientras tanto alguien del equipo le contacta YA."

═══════════════════════════════════════════════════
QUÉ NO HACES (LÍMITES DUROS)
═══════════════════════════════════════════════════
- NUNCA das diagnósticos médicos.
- NUNCA recetas medicamentos ni dosis.
- NUNCA confirmas precios sin verificar con bot_active_services.
- NUNCA inventas fechas, datos clínicos o citas.
- NUNCA hablas mal del paciente, otros médicos, otras clínicas.
- NUNCA compartas datos de OTROS pacientes con quien escribe.

═══════════════════════════════════════════════════
ESCALACIÓN AUTOMÁTICA
═══════════════════════════════════════════════════
Si después de 3 intentos no entiendes lo que pide → escalar_a_humano.
Si pide algo fuera de tus tools → escalar_a_humano.
Si detecta queja, frustración o "ya hablé con ustedes" → escalar_a_humano.

═══════════════════════════════════════════════════
FIRMA
═══════════════════════════════════════════════════
Termina cada mensaje sustancial con: "— Equipo chiropract.co"
(No pongas firma en mensajes cortos como "Sí", "Perfecto", "Listo").

═══════════════════════════════════════════════════
EJEMPLOS FEW-SHOT
═══════════════════════════════════════════════════

Usuario: "hola"
Tú (usa reconocer_paciente primero):
"Buenas tardes, le saluda el equipo de chiropract.co 👋
¿En qué le podemos ayudar hoy?
— Equipo chiropract.co"

Usuario: "cuándo es mi próxima cita?"
Tú (después de reconocer_paciente y consultar_proxima_cita):
"Don Carlos, su próxima cita es el jueves 14 de mayo a las 10:30 AM, seguimiento en el consultorio de Bogotá ✅
¿Confirma asistencia?
— Equipo chiropract.co"

Usuario: "me duele mucho la espalda hace una semana"
Tú (sin diagnosticar):
"Lamento que esté pasando por eso, don Carlos.
Le recomiendo agendar una evaluación con el Dr. Miguel Ángel para que valore el caso en persona.
¿Le proponemos un horario para esta semana?
— Equipo chiropract.co"`;

// ============================================
// CÓDIGO COMPARTIDO PARA TOOLS
// ============================================
const TOOL_RPC_CALL = (rpcName, paramMapping) => `
const fetch = require('node-fetch') || globalThis.fetch;
const params = ${paramMapping};
const r = await this.helpers.httpRequest({
  method: 'POST',
  url: '${SUPABASE_URL}/rest/v1/rpc/${rpcName}',
  ${SUPA_HEADERS},
  body: JSON.stringify(params),
  json: true,
});
return JSON.stringify(r);
`;

// Mejor: cada tool node usa httpRequest helper directamente sin fetch
function makeRpcTool(name, description, paramSchema, rpcName, paramBuilder) {
  return {
    parameters: {
      name,
      description,
      jsCode: `
const input = $input.first().json;
const params = ${paramBuilder};
try {
  const r = await this.helpers.httpRequest({
    method: 'POST',
    url: '${SUPABASE_URL}/rest/v1/rpc/${rpcName}',
    headers: {
      apikey: '${SERVICE_ROLE}',
      Authorization: 'Bearer ${SERVICE_ROLE}',
      'Content-Type': 'application/json',
    },
    body: params,
    json: true,
  });
  return typeof r === 'string' ? r : JSON.stringify(r);
} catch (e) {
  return JSON.stringify({ error: e.message || 'tool failed' });
}
      `.trim(),
    },
  };
}

const TOOLS = [
  {
    id: 'tool-recognize',
    name: 'reconocer_paciente',
    description: 'OBLIGATORIO al iniciar conversación. Busca al paciente por su número de teléfono actual (ya disponible en context). No requiere parámetros — usa el teléfono del usuario actual automáticamente. Devuelve: patient_id, full_name, status, total_visits, last_visit, is_vip. Si NO encuentra, retorna array vacío (= es lead nuevo).',
    rpc: 'bot_recognize_patient',
    params: `{ p_phone: input.Telefono || '' }`,
  },
  {
    id: 'tool-upcoming-appts',
    name: 'consultar_proxima_cita',
    description: 'Lista las próximas 3 citas del paciente. Útil cuando pregunta por su cita, quiere reagendar, o cancelar. Usa el teléfono del usuario.',
    rpc: 'bot_upcoming_appointments',
    params: `{ p_phone: input.Telefono || '', p_limit: 3 }`,
  },
  {
    id: 'tool-jornadas',
    name: 'consultar_jornadas',
    description: 'Lista próximas jornadas itinerantes con cupos disponibles. Parámetro opcional p_city para filtrar (ej. "Soatá", "Guamal", "Muzo", "Garcés Navas"). Si no se sabe la ciudad, llama sin filtro.',
    rpc: 'bot_upcoming_jornadas',
    params: `{ p_tenant_id: input.tenant_id, p_city: input.city_filter || null, p_limit: 5 }`,
  },
  {
    id: 'tool-services',
    name: 'consultar_servicios',
    description: 'Catálogo de servicios activos con precios. Llamar cuando preguntan "cuánto cuesta", "qué servicios tienen", precios, paquetes.',
    rpc: 'bot_active_services',
    params: `{ p_tenant_id: input.tenant_id }`,
  },
  {
    id: 'tool-appoint',
    name: 'agendar_cita_pendiente',
    description: 'Crea una cita PENDIENTE para que recepción confirme. SOLO usar después de tener: patient_id, fecha (YYYY-MM-DD futura), hora (HH:MM), tipo (primera_consulta|seguimiento|jornada|emergencia). El paciente debe haber sido reconocido primero. NO inventes patient_id. Si es lead nuevo, usa registrar_lead en lugar.',
    rpc: 'bot_request_appointment',
    params: `{
      p_tenant_id: input.tenant_id,
      p_patient_id: input.patient_id,
      p_patient_name: input.patient_name || input.Nombre,
      p_date: input.fecha,
      p_time: input.hora,
      p_type: input.tipo || 'seguimiento',
      p_location: input.ubicacion || 'consultorio',
      p_notes: input.notas || null
    }`,
  },
  {
    id: 'tool-reschedule',
    name: 'solicitar_reagendar',
    description: 'Marca una cita existente para reagendar. Necesita appointment_id. Crea alerta en CRM. NO mueve la fecha — solo solicita el cambio.',
    rpc: 'bot_request_reschedule',
    params: `{ p_appointment_id: input.appointment_id, p_preferred_date: input.fecha_preferida || null, p_reason: input.motivo || null }`,
  },
  {
    id: 'tool-cancel',
    name: 'solicitar_cancelar',
    description: 'Cancela una cita inmediatamente. Necesita appointment_id. Confirma con el usuario antes de llamarla.',
    rpc: 'bot_cancel_appointment',
    params: `{ p_appointment_id: input.appointment_id, p_reason: input.motivo || null }`,
  },
  {
    id: 'tool-receipts',
    name: 'consultar_recibos',
    description: 'Lista los últimos 5 recibos del paciente. Útil cuando pide su recibo.',
    rpc: 'bot_get_recent_receipts',
    params: `{ p_phone: input.Telefono || '', p_limit: 5 }`,
  },
  {
    id: 'tool-lead',
    name: 'registrar_lead',
    description: 'Registra un lead nuevo cuando NO es paciente registrado y muestra interés. Toma nombre, teléfono (del context), ciudad opcional, motivo opcional.',
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
    description: 'Crea alerta inmediata para que el equipo atienda al paciente. Usar cuando: pide hablar con persona, emergencia médica (urgency=urgent), queja (urgency=high), o algo fuera de capacidades del bot. Después responde al usuario que un humano le va a responder.',
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

// ============================================
// WORKFLOW DEFINITION
// ============================================
const baseToolNodes = TOOLS.map((t, i) => ({
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
    headers: {
      apikey: '${SERVICE_ROLE}',
      Authorization: 'Bearer ${SERVICE_ROLE}',
      'Content-Type': 'application/json',
    },
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
}));

const toolConnections = {};
TOOLS.forEach((t) => {
  toolConnections[t.name] = { ai_tool: [[{ node: 'chiropract Agent', type: 'ai_tool', index: 0 }]] };
});

(async () => {
  const workflow = {
    name: 'MAD-Quiropraxia - Bot Inbound (WhatsApp + OpenAI + RAG)',
    nodes: [
      // [0] Webhook
      { parameters: { httpMethod: 'POST', path: 'mad-quiropraxia-evolution', options: {} }, id: 'webhook', name: 'Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2.1, position: [240, 400], webhookId: 'mad-quiropraxia-evolution' },
      // [1] IF entrante
      { parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ id: 'fromMe', leftValue: '={{ $json.body?.data?.key?.fromMe ?? true }}', rightValue: false, operator: { type: 'boolean', operation: 'equals', singleValue: true } }], combinator: 'and' }, options: {} }, id: 'if-inbound', name: 'IF Mensaje Entrante', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [460, 400] },
      // [2] IF Es Texto
      { parameters: { conditions: { options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ id: 'is-text', leftValue: '={{ ($json.body?.data?.message?.conversation || $json.body?.data?.message?.extendedTextMessage?.text || \"\") }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' }, options: {} }, id: 'if-text', name: 'IF Es Texto', type: 'n8n-nodes-base.if', typeVersion: 2.2, position: [680, 400] },
      // [3] Set Text Fields
      { parameters: { assignments: { assignments: [
        { id: 't1', name: 'Telefono', value: '={{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
        { id: 't2', name: 'Nombre', value: '={{ $json.body.data.pushName || \"Cliente\" }}', type: 'string' },
        { id: 't3', name: 'Mensaje', value: '={{ $json.body.data.message?.conversation || $json.body.data.message?.extendedTextMessage?.text || \"\" }}', type: 'string' },
        { id: 't4', name: 'sessionIdSafe', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
        { id: 't5', name: 'session_key', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
      ] }, options: {} }, id: 'set-text', name: 'Set Text Fields', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [900, 280] },
      // [4] Set Audio Fields
      { parameters: { assignments: { assignments: [
        { id: 'a1', name: 'Telefono', value: '={{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
        { id: 'a2', name: 'Nombre', value: '={{ $json.body.data.pushName || \"Cliente\" }}', type: 'string' },
        { id: 'a3', name: 'sessionIdSafe', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
        { id: 'a4', name: 'session_key', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
        { id: 'a5', name: 'message_key', value: '={{ JSON.stringify($json.body.data.key) }}', type: 'string' },
      ] }, options: {} }, id: 'set-audio', name: 'Set Audio Fields', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [900, 520] },
      // [5] Download Audio Base64
      { parameters: { method: 'POST', url: EVO_BASE + '/chat/getBase64FromMediaMessage/' + encodeURIComponent(EVO_NAME), sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: EVO_KEY }, { name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ message: { key: JSON.parse($json.message_key) }, convertToMp4: false }) }}', options: {} }, id: 'download-audio', name: 'Download Audio Base64', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1120, 520] },
      // [6] Base64 to Binary
      { parameters: { jsCode: `const r = $input.first().json;
const base64 = r.base64 || '';
const mime = r.mimetype || 'audio/ogg';
if (!base64) return [];
const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') ? 'm4a' : 'ogg';
return [{ json: $('Set Audio Fields').first().json, binary: { data: { data: base64, mimeType: mime, fileName: 'audio.' + ext } } }];` }, id: 'b64-to-bin', name: 'Base64 to Binary', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1340, 520] },
      // [7] Whisper
      { parameters: { method: 'POST', url: 'https://api.openai.com/v1/audio/transcriptions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [{ name: 'model', value: 'whisper-1' }, { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' }, { name: 'language', value: 'es' }] }, options: {} }, id: 'whisper', name: 'OpenAI Transcribe', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1560, 520], credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } } },
      // [8] Set Transcript
      { parameters: { jsCode: `const w = $input.first().json;
const a = $('Set Audio Fields').first().json;
const transcript = w.text || '[no se pudo transcribir]';
return [{ json: { Telefono: a.Telefono, Nombre: a.Nombre, Mensaje: transcript, sessionIdSafe: a.sessionIdSafe, session_key: a.session_key } }];` }, id: 'set-transcript', name: 'Set Transcript as Mensaje', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1780, 520] },
      // [9] Resolve Paciente RPC
      { parameters: { method: 'POST', url: SUPABASE_URL + '/rest/v1/rpc/resolve_inbound_phone', sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: SERVICE_ROLE }, { name: 'Authorization', value: 'Bearer ' + SERVICE_ROLE }, { name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ p_phone: $json.Telefono, p_evolution_instance_id: "' + EVO_INSTANCE_ID + '" }) }}', options: {} }, id: 'resolve-rpc', name: 'Resolve Paciente RPC', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2000, 400] },
      // [10] Normalize Lead Context (con TODOS los campos para los tools)
      { parameters: { assignments: { assignments: [
        { id: 'n1', name: 'Telefono', value: '={{ $json.Telefono || $(\"Set Text Fields\")?.first()?.json?.Telefono || $(\"Set Transcript as Mensaje\")?.first()?.json?.Telefono }}', type: 'string' },
        { id: 'n2', name: 'Nombre', value: '={{ $json.Nombre || \"Visitante\" }}', type: 'string' },
        { id: 'n3', name: 'Mensaje', value: '={{ $json.Mensaje }}', type: 'string' },
        { id: 'n4', name: 'sessionIdSafe', value: '={{ $json.sessionIdSafe }}', type: 'string' },
        { id: 'n5', name: 'session_key', value: '={{ $json.session_key }}', type: 'string' },
      ] }, options: {} }, id: 'normalize', name: 'Normalize Lead Context', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [2220, 400] },
      // [11] AI Agent (top-tier system message)
      { parameters: { promptType: 'define', text: `=DATOS DEL USUARIO:
Nombre WhatsApp: {{ $json.Nombre }}
Teléfono: {{ $json.Telefono }}

MENSAJE DEL USUARIO:
{{ $json.Mensaje }}`, options: { systemMessage: SYSTEM_MSG, maxIterations: 8 } }, id: 'agent', name: 'chiropract Agent', type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 1.7, position: [2440, 400] },
      // [12] OpenAI Chat Model — gpt-4o
      { parameters: { model: { __rl: true, value: 'gpt-4o', mode: 'list', cachedResultName: 'gpt-4o' }, options: { temperature: 0.3, maxTokens: 800 } }, id: 'llm', name: 'OpenAI Chat Model', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi', typeVersion: 1.2, position: [2360, 600], credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } } },
      // [13] Postgres Memory
      { parameters: { sessionIdType: 'customKey', sessionKey: '={{ $json.session_key }}', tableName: 'whatsapp_chat_history', contextWindowLength: 30 }, id: 'memory', name: 'Postgres Chat Memory', type: '@n8n/n8n-nodes-langchain.memoryPostgresChat', typeVersion: 1.3, position: [2520, 600], credentials: { postgres: { id: PG_CRED_ID, name: 'Supabase chiropract.co' } } },
      // [14-23] Tools
      ...baseToolNodes,
      // [24] Prepare Reply
      { parameters: { assignments: { assignments: [
        { id: 'p1', name: 'number', value: '={{ $(\"Normalize Lead Context\").first().json.Telefono }}', type: 'string' },
        { id: 'p2', name: 'text', value: '={{ $json.output }}', type: 'string' },
      ] }, options: {} }, id: 'prepare-reply', name: 'Prepare Reply', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [2660, 400] },
      // [25] Send WhatsApp
      { parameters: { method: 'POST', url: EVO_BASE + '/message/sendText/' + encodeURIComponent(EVO_NAME), sendHeaders: true, headerParameters: { parameters: [{ name: 'apikey', value: EVO_KEY }, { name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify({ number: $json.number, text: $json.text }) }}', options: {} }, id: 'send', name: 'Send WhatsApp Reply', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2880, 400] },
    ],
    connections: {
      'Webhook': { main: [[{ node: 'IF Mensaje Entrante', type: 'main', index: 0 }]] },
      'IF Mensaje Entrante': { main: [[{ node: 'IF Es Texto', type: 'main', index: 0 }], []] },
      'IF Es Texto': { main: [[{ node: 'Set Text Fields', type: 'main', index: 0 }], [{ node: 'Set Audio Fields', type: 'main', index: 0 }]] },
      'Set Text Fields': { main: [[{ node: 'Resolve Paciente RPC', type: 'main', index: 0 }]] },
      'Set Audio Fields': { main: [[{ node: 'Download Audio Base64', type: 'main', index: 0 }]] },
      'Download Audio Base64': { main: [[{ node: 'Base64 to Binary', type: 'main', index: 0 }]] },
      'Base64 to Binary': { main: [[{ node: 'OpenAI Transcribe', type: 'main', index: 0 }]] },
      'OpenAI Transcribe': { main: [[{ node: 'Set Transcript as Mensaje', type: 'main', index: 0 }]] },
      'Set Transcript as Mensaje': { main: [[{ node: 'Resolve Paciente RPC', type: 'main', index: 0 }]] },
      'Resolve Paciente RPC': { main: [[{ node: 'Normalize Lead Context', type: 'main', index: 0 }]] },
      'Normalize Lead Context': { main: [[{ node: 'chiropract Agent', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'chiropract Agent', type: 'ai_languageModel', index: 0 }]] },
      'Postgres Chat Memory': { ai_memory: [[{ node: 'chiropract Agent', type: 'ai_memory', index: 0 }]] },
      ...toolConnections,
      'chiropract Agent': { main: [[{ node: 'Prepare Reply', type: 'main', index: 0 }]] },
      'Prepare Reply': { main: [[{ node: 'Send WhatsApp Reply', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
  };

  console.log('Total nodos:', workflow.nodes.length);
  console.log('Tools conectadas:', TOOLS.length);

  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  console.log('PUT:', r.status);
  if (!r.ok) { console.log(await r.text()); return; }
  await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('✅ Bot top-tier deployado');
})();
