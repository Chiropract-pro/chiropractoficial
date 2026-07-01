// Reescribe el workflow basado EXACTO en el patrón de IOSBogota WhatsApp Bot.
// Adaptado a Evolution API (en vez de YCloud) y al system prompt de chiropract.co.

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
3. Sugerir reagendar (NO confirme fechas — el equipo coordinará).
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
      // [0] Webhook Evolution
      {
        parameters: {
          httpMethod: 'POST',
          path: 'mad-quiropraxia-evolution',
          options: {},
        },
        id: 'webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2.1,
        position: [240, 300],
        webhookId: 'mad-quiropraxia-evolution',
      },

      // [1] IF: solo mensajes entrantes (no fromMe)
      {
        parameters: {
          conditions: {
            options: { caseSensitive: true, typeValidation: 'loose', version: 2 },
            conditions: [
              {
                id: 'cond-from-me',
                leftValue: '={{ $json.body?.data?.key?.fromMe ?? true }}',
                rightValue: false,
                operator: { type: 'boolean', operation: 'equals', singleValue: true },
              },
            ],
            combinator: 'and',
          },
          options: {},
        },
        id: 'if-inbound',
        name: 'IF Mensaje Entrante',
        type: 'n8n-nodes-base.if',
        typeVersion: 2.2,
        position: [460, 300],
      },

      // [2] Set: extraer campos del payload de Evolution
      {
        parameters: {
          assignments: {
            assignments: [
              {
                id: 'a1',
                name: 'Telefono',
                value: '={{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}',
                type: 'string',
              },
              {
                id: 'a2',
                name: 'Nombre',
                value: '={{ $json.body.data.pushName || \"Cliente\" }}',
                type: 'string',
              },
              {
                id: 'a3',
                name: 'Mensaje',
                value: '={{ $json.body.data.message?.conversation || $json.body.data.message?.extendedTextMessage?.text || $json.body.data.message?.imageMessage?.caption || \"\" }}',
                type: 'string',
              },
              {
                id: 'a4',
                name: 'sessionIdSafe',
                value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}',
                type: 'string',
              },
              {
                id: 'a5',
                name: 'session_key',
                value: '=chiropract:{{ ($json.body.data.key.remoteJid || \"\").replace(\"@s.whatsapp.net\", \"\").replace(/\\D/g, \"\") }}',
                type: 'string',
              },
              {
                id: 'a6',
                name: 'evolution_message_id',
                value: '={{ $json.body.data.key.id }}',
                type: 'string',
              },
            ],
          },
          options: {},
        },
        id: 'set-fields',
        name: 'Set Text Fields',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [680, 300],
      },

      // [3] HTTP: resolver paciente vía RPC
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
          jsonBody: '={{ JSON.stringify({ p_phone: $json.Telefono, p_evolution_instance_id: "' + EVO_INSTANCE_ID + '" }) }}',
          options: {},
        },
        id: 'resolve-rpc',
        name: 'Resolve Paciente RPC',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [900, 300],
      },

      // [4] Set: combinar resolve result con campos previos
      {
        parameters: {
          assignments: {
            assignments: [
              {
                id: 'b1',
                name: 'Telefono',
                value: '={{ $(\"Set Text Fields\").first().json.Telefono }}',
                type: 'string',
              },
              {
                id: 'b2',
                name: 'Nombre',
                value: '={{ ($json[0]?.patient_name && $json[0].patient_name !== \"Hola\") ? $json[0].patient_name : ($(\"Set Text Fields\").first().json.Nombre || \"Visitante\") }}',
                type: 'string',
              },
              {
                id: 'b3',
                name: 'Mensaje',
                value: '={{ $(\"Set Text Fields\").first().json.Mensaje }}',
                type: 'string',
              },
              {
                id: 'b4',
                name: 'sessionIdSafe',
                value: '={{ $(\"Set Text Fields\").first().json.sessionIdSafe }}',
                type: 'string',
              },
              {
                id: 'b5',
                name: 'session_key',
                value: '={{ $(\"Set Text Fields\").first().json.session_key }}',
                type: 'string',
              },
              {
                id: 'b6',
                name: 'tenant_id',
                value: '={{ $json[0]?.tenant_id || "" }}',
                type: 'string',
              },
              {
                id: 'b7',
                name: 'patient_id',
                value: '={{ $json[0]?.patient_id || "" }}',
                type: 'string',
              },
              {
                id: 'b8',
                name: 'is_new_lead',
                value: '={{ $json[0]?.is_new_lead === true }}',
                type: 'boolean',
              },
            ],
          },
          options: {},
        },
        id: 'normalize',
        name: 'Normalize Lead Context',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [1120, 300],
      },

      // [5] AI Agent
      {
        parameters: {
          promptType: 'define',
          text: '=DATOS DEL USUARIO:\nNombre: {{ $json.Nombre }}\nTelefono: {{ $json.Telefono }}\nEs nuevo lead: {{ $json.is_new_lead }}\n\nMENSAJE DEL USUARIO:\n{{ $json.Mensaje }}',
          options: { systemMessage: SYSTEM_MSG },
        },
        id: 'agent',
        name: 'chiropract Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.6,
        position: [1340, 300],
      },

      // [6] OpenAI Chat Model (sub-nodo del agent)
      {
        parameters: {
          model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
          options: { temperature: 0.3 },
        },
        id: 'llm',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1.2,
        position: [1260, 520],
        credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
      },

      // [7] Postgres Chat Memory (sub-nodo del agent)
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
        position: [1420, 520],
        credentials: { postgres: { id: PG_CRED_ID, name: 'Supabase chiropract.co' } },
      },

      // [8] Set: preparar payload para Evolution
      {
        parameters: {
          assignments: {
            assignments: [
              {
                id: 'p1',
                name: 'number',
                value: '=57{{ $(\"Normalize Lead Context\").first().json.Telefono }}',
                type: 'string',
              },
              {
                id: 'p2',
                name: 'text',
                value: '={{ $json.output }}',
                type: 'string',
              },
            ],
          },
          options: {},
        },
        id: 'prepare-reply',
        name: 'Prepare Reply',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [1560, 300],
      },

      // [9] HTTP: enviar a Evolution
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
        position: [1780, 300],
      },
    ],
    connections: {
      'Webhook': { main: [[{ node: 'IF Mensaje Entrante', type: 'main', index: 0 }]] },
      'IF Mensaje Entrante': { main: [[{ node: 'Set Text Fields', type: 'main', index: 0 }], []] },
      'Set Text Fields': { main: [[{ node: 'Resolve Paciente RPC', type: 'main', index: 0 }]] },
      'Resolve Paciente RPC': { main: [[{ node: 'Normalize Lead Context', type: 'main', index: 0 }]] },
      'Normalize Lead Context': { main: [[{ node: 'chiropract Agent', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'chiropract Agent', type: 'ai_languageModel', index: 0 }]] },
      'Postgres Chat Memory': { ai_memory: [[{ node: 'chiropract Agent', type: 'ai_memory', index: 0 }]] },
      'chiropract Agent': { main: [[{ node: 'Prepare Reply', type: 'main', index: 0 }]] },
      'Prepare Reply': { main: [[{ node: 'Send WhatsApp Reply', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  };

  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  console.log('PUT:', r.status);
  if (!r.ok) { console.log(await r.text()); return; }

  await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', {
    method: 'POST',
    headers: { 'X-N8N-API-KEY': T },
  });
  console.log('✅ Patrón IOSBogota aplicado');
})();
