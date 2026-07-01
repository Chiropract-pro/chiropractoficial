// Workflow simplificado tipo IOSBogota: text + audio → Agent → Send
// Sin resolve_inbound_phone intermedio (se agrega después como tool).

const N = process.env.N8N_BASE_URL;
const T = process.env.N8N_API_TOKEN;
const EVO_BASE = process.env.EVOLUTION_BASE_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_NAME = 'Miguel Angel Diaz Quiropractico';
const OPENAI_CRED_ID = 'XlxKrDQAS1w750sv';
const OPENAI_CRED_NAME = 'OpenAi account';
const PG_CRED_ID = 'TWsCSq6GjZihPtkS';
const WF_ID = '894oc1X7Z8iuK9H5';

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
1. Saludar y preguntar el nombre si no lo conoces.
2. Sugerir reagendar (NO confirme fechas — el equipo coordinará).
3. Compartir info de jornadas próximas: Soatá, Guamal, Muzo, Garcés Navas.
4. Tips post-sesión: agua, evitar esfuerzos 24h, calor local.
5. Captar leads: nombre, ciudad, motivo de consulta.

QUÉ NO HACES
- NO da diagnósticos médicos.
- NO receta medicamentos.
- NO confirma precios sin verificar.
- NO inventa citas o historiales.

ESCALACIÓN
Si pide hablar con persona, emergencia, o queja → responda "En un momento alguien del equipo le responde personalmente. Si es urgente, llámenos directamente."

FIRMA: Termine mensajes sustanciales con "— Equipo chiropract.co".`;

const BASE64_TO_BIN = `const r = $input.first().json;
const base64 = r.base64 || '';
const mime = r.mimetype || 'audio/ogg';
if (!base64) return [];
const ext = mime.includes('mpeg') ? 'mp3' : mime.includes('mp4') ? 'm4a' : 'ogg';
return [{
  json: $('Set Audio Fields').first().json,
  binary: { data: { data: base64, mimeType: mime, fileName: 'audio.' + ext } }
}];`;

const SET_TRANSCRIPT = `const w = $input.first().json;
const a = $('Set Audio Fields').first().json;
const transcript = w.text || '[no se pudo transcribir]';
return [{ json: {
  Telefono: a.Telefono,
  Nombre: a.Nombre,
  Mensaje: transcript,
  sessionIdSafe: a.sessionIdSafe,
  session_key: a.session_key,
}}];`;

(async () => {
  const workflow = {
    name: 'MAD-Quiropraxia - Bot Inbound (WhatsApp + OpenAI + RAG)',
    nodes: [
      {
        parameters: { httpMethod: 'POST', path: 'mad-quiropraxia-evolution', options: {} },
        id: 'webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [240, 400],
        webhookId: 'mad-quiropraxia-evolution',
      },
      {
        parameters: {
          conditions: {
            options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
            conditions: [
              { id: 'fromMe', leftValue: '={{ $json.body?.data?.key?.fromMe ?? true }}', rightValue: false, operator: { type: 'boolean', operation: 'equals', singleValue: true } },
            ],
            combinator: 'and',
          },
          options: {},
        },
        id: 'if-inbound',
        name: 'IF Mensaje Entrante',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [460, 400],
      },
      {
        parameters: {
          conditions: {
            options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
            conditions: [
              { id: 'is-text', leftValue: '={{ ($json.body?.data?.message?.conversation || $json.body?.data?.message?.extendedTextMessage?.text || \"\") }}', rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } },
            ],
            combinator: 'and',
          },
          options: {},
        },
        id: 'if-text',
        name: 'IF Es Texto',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [680, 400],
      },
      {
        parameters: {
          assignments: {
            assignments: [
              { id: 't1', name: 'Telefono', value: '={{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
              { id: 't2', name: 'Nombre', value: '={{ $json.body.data.pushName || \"Cliente\" }}', type: 'string' },
              { id: 't3', name: 'Mensaje', value: '={{ $json.body.data.message?.conversation || $json.body.data.message?.extendedTextMessage?.text || \"\" }}', type: 'string' },
              { id: 't4', name: 'sessionIdSafe', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
              { id: 't5', name: 'session_key', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
            ],
          },
          options: {},
        },
        id: 'set-text',
        name: 'Set Text Fields',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [900, 280],
      },
      {
        parameters: {
          assignments: {
            assignments: [
              { id: 'a1', name: 'Telefono', value: '={{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
              { id: 'a2', name: 'Nombre', value: '={{ $json.body.data.pushName || \"Cliente\" }}', type: 'string' },
              { id: 'a3', name: 'sessionIdSafe', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
              { id: 'a4', name: 'session_key', value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}', type: 'string' },
              { id: 'a5', name: 'message_key', value: '={{ JSON.stringify($json.body.data.key) }}', type: 'string' },
            ],
          },
          options: {},
        },
        id: 'set-audio',
        name: 'Set Audio Fields',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [900, 520],
      },
      {
        parameters: {
          method: 'POST',
          url: EVO_BASE + '/chat/getBase64FromMediaMessage/' + encodeURIComponent(EVO_NAME),
          sendHeaders: true,
          headerParameters: {
            parameters: [
              { name: 'apikey', value: EVO_KEY },
              { name: 'Content-Type', value: 'application/json' },
            ],
          },
          sendBody: true,
          specifyBody: 'json',
          jsonBody: '={{ JSON.stringify({ message: { key: JSON.parse($json.message_key) }, convertToMp4: false }) }}',
          options: {},
        },
        id: 'download-audio',
        name: 'Download Audio Base64',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [1120, 520],
      },
      {
        parameters: { jsCode: BASE64_TO_BIN },
        id: 'b64-to-bin',
        name: 'Base64 to Binary',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1340, 520],
      },
      {
        parameters: {
          method: 'POST',
          url: 'https://api.openai.com/v1/audio/transcriptions',
          authentication: 'predefinedCredentialType',
          nodeCredentialType: 'openAiApi',
          sendBody: true,
          contentType: 'multipart-form-data',
          bodyParameters: {
            parameters: [
              { name: 'model', value: 'whisper-1' },
              { parameterType: 'formBinaryData', name: 'file', inputDataFieldName: 'data' },
              { name: 'language', value: 'es' },
            ],
          },
          options: {},
        },
        id: 'whisper',
        name: 'OpenAI Transcribe',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [1560, 520],
        credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
      },
      {
        parameters: { jsCode: SET_TRANSCRIPT },
        id: 'set-transcript',
        name: 'Set Transcript as Mensaje',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1780, 520],
      },
      {
        parameters: {
          promptType: 'define',
          text: '=DATOS DEL USUARIO:\nNombre: {{ $json.Nombre }}\nTelefono: {{ $json.Telefono }}\n\nMENSAJE DEL USUARIO:\n{{ $json.Mensaje }}',
          options: { systemMessage: SYSTEM_MSG },
        },
        id: 'agent',
        name: 'chiropract Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.6,
        position: [2000, 400],
      },
      {
        parameters: {
          model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
          options: { temperature: 0.3 },
        },
        id: 'llm',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1.2,
        position: [1920, 600],
        credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
      },
      {
        parameters: {
          sessionIdType: 'customKey',
          sessionKey: '={{ $json.session_key }}',
          tableName: 'whatsapp_chat_history',
        },
        id: 'memory',
        name: 'Postgres Chat Memory',
        type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
        typeVersion: 1.3,
        position: [2080, 600],
        credentials: { postgres: { id: PG_CRED_ID, name: 'Supabase chiropract.co' } },
      },
      {
        parameters: {
          assignments: {
            assignments: [
              { id: 'p1', name: 'number', value: '={{ $node[\"Set Text Fields\"]?.json?.Telefono || $node[\"Set Transcript as Mensaje\"]?.json?.Telefono || $(\"chiropract Agent\").first().json.Telefono }}', type: 'string' },
              { id: 'p2', name: 'text', value: '={{ $json.output }}', type: 'string' },
            ],
          },
          options: {},
        },
        id: 'prepare-reply',
        name: 'Prepare Reply',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [2220, 400],
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
          jsonBody: '={{ JSON.stringify({ number: $json.number, text: $json.text }) }}',
          options: {},
        },
        id: 'send',
        name: 'Send WhatsApp Reply',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [2440, 400],
      },
    ],
    connections: {
      'Webhook': { main: [[{ node: 'IF Mensaje Entrante', type: 'main', index: 0 }]] },
      'IF Mensaje Entrante': { main: [[{ node: 'IF Es Texto', type: 'main', index: 0 }], []] },
      'IF Es Texto': {
        main: [
          [{ node: 'Set Text Fields', type: 'main', index: 0 }],
          [{ node: 'Set Audio Fields', type: 'main', index: 0 }],
        ],
      },
      'Set Text Fields': { main: [[{ node: 'chiropract Agent', type: 'main', index: 0 }]] },
      'Set Audio Fields': { main: [[{ node: 'Download Audio Base64', type: 'main', index: 0 }]] },
      'Download Audio Base64': { main: [[{ node: 'Base64 to Binary', type: 'main', index: 0 }]] },
      'Base64 to Binary': { main: [[{ node: 'OpenAI Transcribe', type: 'main', index: 0 }]] },
      'OpenAI Transcribe': { main: [[{ node: 'Set Transcript as Mensaje', type: 'main', index: 0 }]] },
      'Set Transcript as Mensaje': { main: [[{ node: 'chiropract Agent', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'chiropract Agent', type: 'ai_languageModel', index: 0 }]] },
      'Postgres Chat Memory': { ai_memory: [[{ node: 'chiropract Agent', type: 'ai_memory', index: 0 }]] },
      'chiropract Agent': { main: [[{ node: 'Prepare Reply', type: 'main', index: 0 }]] },
      'Prepare Reply': { main: [[{ node: 'Send WhatsApp Reply', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1' },
  };

  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  console.log('PUT:', r.status);
  if (!r.ok) { console.log(await r.text()); return; }
  await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('✅ Workflow con audio (Whisper) deployado');
})();
