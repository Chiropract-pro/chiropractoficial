// Refactoriza el workflow del bot al patrón AI Agent (igual que Buna).
// 1. Crea credencial Postgres "Supabase chiropract.co"
// 2. Reescribe el workflow completo con: webhook → preprocesar → AI Agent → enviar
// 3. AI Agent conectado a OpenAI Chat Model + Postgres Chat Memory
// 4. Memoria persistida en BD del Dr. Díaz, sessionId = phone normalizado

import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
const WF_ID = '894oc1X7Z8iuK9H5';

// Parsear connection string de Supabase
function parseDbUrl(url) {
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/);
  if (!m) throw new Error('Bad DB URL');
  return { user: m[1], password: m[2], host: m[3], port: parseInt(m[4]), database: m[5].split('?')[0] };
}

async function n8n(method, p, body) {
  const r = await fetch(N + p, {
    method,
    headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status}: ${t.slice(0, 300)}`);
  try { return JSON.parse(t); } catch { return t; }
}

async function findOrCreatePostgresCred() {
  const list = await n8n('GET', '/api/v1/credentials');
  // n8n a veces no devuelve credentials con el GET — necesito otra estrategia
  // Intentar crear y manejar conflicto

  const cfg = parseDbUrl(process.env.SUPABASE_DB_URL);
  const data = {
    host: cfg.host,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    port: cfg.port,
    ssl: 'require',
    allowUnauthorizedCerts: false,
    sshTunnel: false,
  };

  try {
    const created = await n8n('POST', '/api/v1/credentials', {
      name: 'Supabase chiropract.co',
      type: 'postgres',
      data,
    });
    console.log(`  ✅ Credencial creada: ${created.id}`);
    return created.id;
  } catch (e) {
    if (e.message.includes('already exists') || e.message.includes('duplicate')) {
      // Find existing
      const list = await n8n('GET', '/api/v1/credentials');
      const found = (list.data || []).find(c => c.name === 'Supabase chiropract.co');
      if (found) return found.id;
    }
    throw e;
  }
}

const NORMALIZE_CODE = `// Normaliza el payload de Evolution API
const body = $input.first().json.body || $input.first().json;
const data = body.data || {};
const remoteJid = data.key && data.key.remoteJid || '';
const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\\D/g, '');
const fromMe = data.key && data.key.fromMe;

const message = (data.message && data.message.conversation)
  || (data.message && data.message.extendedTextMessage && data.message.extendedTextMessage.text)
  || (data.message && data.message.imageMessage && data.message.imageMessage.caption)
  || '';

if (!phone || !message || fromMe) {
  return [];
}

return [{ json: {
  Telefono: phone,
  Mensaje: message,
  sessionIdSafe: 'chiropract_' + phone,
  evolution_message_id: data.key && data.key.id,
}}];`;

const RESOLVE_CODE = `// Resolver paciente vía RPC para enriquecer contexto
const phone = $json.Telefono;
const r = await fetch('${SUPABASE_URL}/rest/v1/rpc/resolve_inbound_phone', {
  method: 'POST',
  headers: {
    'apikey': '${SERVICE_ROLE}',
    'Authorization': 'Bearer ${SERVICE_ROLE}',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ p_phone: phone, p_evolution_instance_id: '${EVO_INSTANCE_ID}' }),
});
const data = await r.json();
const row = Array.isArray(data) ? data[0] : data;

if (!row || !row.tenant_id) {
  return [];
}

return [{ json: Object.assign({}, $json, {
  Nombre: row.patient_name && row.patient_name !== 'Hola' ? row.patient_name : 'Visitante',
  tenant_id: row.tenant_id,
  patient_id: row.patient_id,
  is_new_lead: row.is_new_lead === true,
  conversation_id: row.conversation_id,
})}];`;

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

const SEND_REPLY_CODE = `// Toma la respuesta del agent y la envía vía Evolution
const reply = $json.output || '';
const phone = $('Resolver paciente').first().json.Telefono;

if (!reply || !phone) return [];

const r = await fetch('${EVO_BASE}/message/sendText/${encodeURIComponent(EVO_NAME)}', {
  method: 'POST',
  headers: { 'apikey': '${EVO_KEY}', 'Content-Type': 'application/json' },
  body: JSON.stringify({ number: '57' + phone, text: reply }),
});

const result = await r.json();
return [{ json: { sent: r.ok, result, reply, phone } }];`;

(async () => {
  console.log('🔐 Buscando/creando credencial Postgres...');
  const pgCredId = await findOrCreatePostgresCred();

  console.log('\\n📦 Construyendo nuevo workflow con patrón AI Agent...');

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
        parameters: { jsCode: RESOLVE_CODE },
        id: 'resolve',
        name: 'Resolver paciente',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [680, 300],
      },
      {
        parameters: {
          promptType: 'define',
          text: '=DATOS DEL USUARIO:\\nNombre: {{ $json.Nombre }}\\nTeléfono: {{ $json.Telefono }}\\nEs nuevo lead: {{ $json.is_new_lead }}\\n\\nMENSAJE:\\n{{ $json.Mensaje }}',
          options: { systemMessage: SYSTEM_MSG },
        },
        id: 'agent',
        name: 'AI Agent',
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 1.7,
        position: [900, 300],
      },
      {
        parameters: { model: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' }, options: {} },
        id: 'llm',
        name: 'OpenAI Chat Model',
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1.2,
        position: [820, 500],
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
        position: [980, 500],
        credentials: { postgres: { id: pgCredId, name: 'Supabase chiropract.co' } },
      },
      {
        parameters: { jsCode: SEND_REPLY_CODE },
        id: 'send',
        name: 'Enviar WhatsApp',
        type: 'n8n-nodes-base.code',
        typeVersion: 2,
        position: [1140, 300],
      },
    ],
    connections: {
      'Webhook Evolution': { main: [[{ node: 'Normalizar mensaje', type: 'main', index: 0 }]] },
      'Normalizar mensaje': { main: [[{ node: 'Resolver paciente', type: 'main', index: 0 }]] },
      'Resolver paciente': { main: [[{ node: 'AI Agent', type: 'main', index: 0 }]] },
      'OpenAI Chat Model': { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] },
      'Postgres Chat Memory': { ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]] },
      'AI Agent': { main: [[{ node: 'Enviar WhatsApp', type: 'main', index: 0 }]] },
    },
    settings: { executionOrder: 'v1', timezone: 'America/Bogota' },
  };

  console.log('  Nodes:', workflow.nodes.length);
  console.log('  Connections:', Object.keys(workflow.connections).length);

  // PUT al workflow existente
  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  console.log('\\nPUT:', r.status);
  if (!r.ok) { console.log(await r.text()); return; }

  await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', { method: 'POST', headers: { 'X-N8N-API-KEY': T } });
  console.log('✅ Workflow refactorizado y activado');
})();
