// v2: usa HTTP Request nodes en lugar de fetch en Code nodes.

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
const PG_CRED_ID = 'GdD5uN5h1gyct6KF';
const WF_ID = '894oc1X7Z8iuK9H5';

const NORMALIZE_CODE = `const body = $input.first().json.body || $input.first().json;
const data = body.data || {};
const remoteJid = (data.key && data.key.remoteJid) || '';
const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\\D/g, '');
const fromMe = data.key && data.key.fromMe;

const message = (data.message && data.message.conversation)
  || (data.message && data.message.extendedTextMessage && data.message.extendedTextMessage.text)
  || (data.message && data.message.imageMessage && data.message.imageMessage.caption)
  || '';

if (!phone || !message || fromMe) return [];

return [{ json: {
  Telefono: phone,
  Mensaje: message,
  sessionIdSafe: 'chiropract_' + phone,
  evolution_message_id: data.key && data.key.id,
}}];`;

const ENRICH_CODE = `// Combina resultado de RPC con datos originales
const resolved = $input.item.json;
const orig = $('Normalizar mensaje').first().json;

// La RPC devuelve un array; tomar primero
const row = Array.isArray(resolved) ? resolved[0] : resolved;

if (!row || !row.tenant_id) {
  return [];
}

return [{ json: {
  Telefono: orig.Telefono,
  Mensaje: orig.Mensaje,
  sessionIdSafe: orig.sessionIdSafe,
  Nombre: row.patient_name && row.patient_name !== 'Hola' ? row.patient_name : 'Visitante',
  tenant_id: row.tenant_id,
  patient_id: row.patient_id,
  is_new_lead: row.is_new_lead === true,
  conversation_id: row.conversation_id,
}}];`;

const SYSTEM_MSG = `Eres el asistente virtual del equipo de chiropract.co, la clínica del Dr. Miguel Ángel Díaz.

IDENTIDAD
- Te identificas como "el equipo de chiropract.co". Nunca te haces pasar por el Dr. Díaz directamente.
- chiropract.co integra quiropraxia, ortopedia y fisioterapia. El Dr. Miguel Ángel Díaz lleva 15+ años practicando este método integrado.
- Atiende en su consultorio en Bogotá y en jornadas itinerantes en Soatá, Guamal, Muzo y Garcés Navas.
- Filosofía: "Tu columna no debería esperar a que llegues a la capital."

TONO
- Trate al usuario de "usted". Es Colombia y muchos son adultos mayores.
- Cálido, profesional, cercano. Como un amigo que sabe de medicina.
- No use jerga médica innecesaria.
- Mensajes cortos (1-3 párrafos). Esto es WhatsApp, no email.
- Use emojis con moderación: 📅 🕐 📍 🧾 💳 ✅ ❌ 🔄.

QUÉ HACES
1. Saludar y preguntar el nombre si no está registrado.
2. Confirmar/recordar próximas citas si el paciente las tiene.
3. Sugerir reagendar (pero NO confirme fechas — el equipo coordinará).
4. Compartir info de jornadas próximas: Soatá, Guamal, Muzo, Garcés Navas.
5. Tips post-sesión: agua, evitar esfuerzos 24h, calor local.
6. Captar leads: nombre, ciudad, motivo de consulta.

QUÉ NO HACES
- NO da diagnósticos médicos.
- NO receta medicamentos.
- NO confirma precios sin verificar.
- NO inventa citas o historiales.

ESCALACIÓN
Si pide hablar con persona, emergencia, o queja → responda "En un momento alguien del equipo le responde personalmente. Si es urgente, llámenos directamente."

FIRMA: Termine mensajes sustanciales con "— Equipo chiropract.co".`;

(async () => {
  const workflow = {
    name: 'MAD-Quiropraxia - Bot Inbound (WhatsApp + OpenAI + RAG)',
    nodes: [
      {
        parameters: { httpMethod: 'POST', path: 'mad-quiropraxia-evolution', responseMode: 'lastNode', options: {} },
        id: 'webhook',
        name: 'Webhook Evolution',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [240, 300],
        webhookId: 'mad-quiropraxia-evolution',
      },
      {
        parameters: { jsCode: NORMALIZE_CODE },
        id: 'normalize',
        name: 'Normalizar mensaje',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [460, 300],
      },
      {
        parameters: {
          method: 'POST',
          url: SUPABASE_URL + '/rest/v1/rpc/resolve_inbound_phone',
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'apikey', value: SERVICE_ROLE },
              { name: 'Authorization', value: 'Bearer ' + SERVICE_ROLE },
              { name: 'Content-Type', value: 'application/json' },
            ],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={\n  "p_phone": "{{ $json.Telefono }}",\n  "p_evolution_instance_id": "' + EVO_INSTANCE_ID + '"\n}',
          options: {},
        },
        id: 'resolve-rpc',
        name: 'Llamar resolve_inbound_phone',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [680, 300],
      },
      {
        parameters: { jsCode: ENRICH_CODE },
        id: 'enrich',
        name: 'Enriquecer contexto',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [880, 300],
      },
      {
        parameters: {
          promptType: 'define',
          text: '=DATOS DEL USUARIO:\nNombre: {{ $json.Nombre }}\nTeléfono: {{ $json.Telefono }}\nEs nuevo lead: {{ $json.is_new_lead }}\n\nMENSAJE:\n{{ $json.Mensaje }}',
          options: { systemMessage: SYSTEM_MSG },
        },
        id: 'agent',
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.7,
        position: [1100, 300],
      },
      {
        parameters: { model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' }, options: {} },
        id: 'llm',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1.2,
        position: [1020, 500],
        credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
      },
      {
        parameters: {
          sessionIdType: 'customKey',
          sessionKey: '={{ $json.sessionIdSafe }}',
          tableName: 'whatsapp_chat_history',
        },
        id: 'memory',
        name: 'Postgres Chat Memory',
        type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
        typeVersion: 1.3,
        position: [1180, 500],
        credentials: { postgres: { id: PG_CRED_ID, name: 'Supabase chiropract.co' } },
      },
      {
        parameters: {
          method: 'POST',
          url: EVO_BASE + '/message/sendText/' + encodeURIComponent(EVO_NAME),
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'apikey', value: EVO_KEY },
              { name: 'Content-Type', value: 'application/json' },
            ],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={\n  "number": "57{{ $(\'Enriquecer contexto\').first().json.Telefono }}",\n  "text": {{ JSON.stringify($json.output) }}\n}',
          options: {},
        },
        id: 'send',
        name: 'Enviar WhatsApp',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [1320, 300],
      },
    ],
    connections: {
      'Webhook Evolution': { main: [[{ node: 'Normalizar mensaje', type: 'main', index: 0 }]] },
      'Normalizar mensaje': { main: [[{ node: 'Llamar resolve_inbound_phone', type: 'main', index: 0 }]] },
      'Llamar resolve_inbound_phone': { main: [[{ node: 'Enriquecer contexto', type: 'main', index: 0 }]] },
      'Enriquecer contexto': { main: [[{ node: 'AI Agent', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] },
      'Postgres Chat Memory': { ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]] },
      'AI Agent': { main: [[{ node: 'Enviar WhatsApp', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  };

  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  console.log('PUT:', r.status);
  if (!r.ok) { console.log(await r.text()); return; }

  await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('✅ v2 deployado');
})();
