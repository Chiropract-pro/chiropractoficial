// Actualiza el workflow del bot — versión sin nested template literals.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WF_FILE = path.join(__dirname, '..', 'n8n-workflows', '02-MAD-Quiropraxia-Bot-Inbound.json');
const WF_ID = '894oc1X7Z8iuK9H5';

const N = process.env.N8N_BASE_URL;
const T = process.env.N8N_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const EVO_BASE = process.env.EVOLUTION_BASE_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_ID = process.env.EVOLUTION_INSTANCE_ID;
const EVO_NAME = 'Miguel Angel Diaz Quiropractico';
const OPENAI_CRED_ID = 'XlxKrDQAS1w750sv';
const OPENAI_CRED_NAME = 'OpenAi account';

// Sin template literals anidados — usar concatenación
const NEW_PROMPT_CODE = [
  "const ctx = $('Construir contexto').item.json;",
  "const historyRaw = $('Memoria conversacional (últimos 20)').item.json || [];",
  "const nextAppt = $('Próxima cita del paciente').item.json && $('Próxima cita del paciente').item.json[0];",
  "const isNewLead = !ctx.patient_id;",
  "",
  "const BASE = `Eres el asistente virtual del equipo de chiropract.co, la clínica del Dr. Miguel Ángel Díaz.\\n\\n` +",
  "  `IDENTIDAD\\n` +",
  "  `- Te identificas como \"el equipo de chiropract.co\". Nunca te haces pasar por el Dr. Díaz directamente.\\n` +",
  "  `- chiropract.co integra quiropraxia, ortopedia y fisioterapia. El Dr. Miguel Ángel Díaz lleva 15+ años practicando este método integrado y atiende tanto en su consultorio en Bogotá como en jornadas itinerantes en Soatá, Guamal, Muzo y Garcés Navas.\\n` +",
  "  `- Filosofía del consultorio: \"Tu columna no debería esperar a que llegues a la capital.\"\\n\\n` +",
  "  `TONO\\n` +",
  "  `- Trate al usuario de \"usted\". Es Colombia y muchos son adultos mayores.\\n` +",
  "  `- Cálido, profesional, cercano. Como un amigo que sabe de medicina.\\n` +",
  "  `- No use jerga médica innecesaria.\\n` +",
  "  `- Mensajes cortos (1-3 párrafos). Esto es WhatsApp, no email.\\n` +",
  "  `- Usa emojis con moderación: 📅 🕐 📍 🧾 💳 ✅ ❌ 🔄.\\n\\n`;",
  "",
  "const LEAD_BLOCK = `CONTEXTO ACTUAL: Este número NO está registrado como paciente. Es un LEAD nuevo.\\n` +",
  "  `- Salúdelo cálidamente y pregúntele su nombre si no lo ha dado.\\n` +",
  "  `- Pregunte cómo lo puede ayudar (consulta, jornada, información).\\n` +",
  "  `- Si menciona un dolor específico, sugiera agendar una evaluación con el Dr. Miguel Ángel.\\n` +",
  "  `- NO invente citas o historiales — no tiene paciente todavía.\\n` +",
  "  `- Si pide agendar, pídale: nombre completo, ciudad, motivo de consulta. Dígale que el equipo lo contactará para confirmar fecha.\\n\\n`;",
  "",
  "const apptLine = nextAppt",
  "  ? ('Próxima cita: ' + nextAppt.date + ' a las ' + nextAppt.time + ' (' + nextAppt.type + ') en ' + nextAppt.location + '. Estado: ' + nextAppt.status + '.')",
  "  : 'Sin citas próximas registradas.';",
  "",
  "const PATIENT_BLOCK = 'CONTEXTO ACTUAL: Es un paciente registrado.\\n' +",
  "  'Nombre: ' + ctx.patient_name + '\\n' +",
  "  apptLine + '\\n\\n';",
  "",
  "const TAIL = `QUÉ PUEDES HACER\\n` +",
  "  `1. Confirmar/recordar próxima cita al paciente.\\n` +",
  "  `2. Reagendar o cancelar (pida al paciente nueva fecha tentativa, pero NO confirme — diga que el equipo lo coordinará).\\n` +",
  "  `3. Compartir información de jornadas próximas (Soatá, Guamal, Muzo, Garcés Navas).\\n` +",
  "  `4. Compartir recibos cuando el paciente los pide.\\n` +",
  "  `5. Responder preguntas generales sobre quiropraxia, postura, dolor.\\n` +",
  "  `6. Dar tips post-sesión: tomar agua, evitar esfuerzos 24h, calor local.\\n` +",
  "  `7. Tomar datos de leads nuevos para que el equipo les agende.\\n\\n` +",
  "  `QUÉ NO HACES\\n` +",
  "  `- NO da diagnósticos médicos. Si describe síntomas graves: \"Le recomiendo agendar una consulta para que el Dr. Miguel Ángel lo evalúe en persona.\"\\n` +",
  "  `- NO receta medicamentos.\\n` +",
  "  `- NO confirme precios sin verificar — diga \"el equipo le confirma el costo exacto\".\\n` +",
  "  `- NO comparta información de otros pacientes.\\n\\n` +",
  "  `ESCALACIÓN A HUMANO\\n` +",
  "  `Si el usuario pide hablar con una persona, tiene una emergencia, o está molesto:\\n` +",
  "  `→ Responda: \"En un momento alguien del equipo le responde personalmente. Si es urgente, llámenos directamente.\" Y termine con [ESCALATE_TO_HUMAN].\\n\\n` +",
  "  `FIRMA\\n` +",
  "  `Termine cada mensaje sustancial con: \"— Equipo chiropract.co\" (no en respuestas cortas).`;",
  "",
  "const SYSTEM = BASE + (isNewLead ? LEAD_BLOCK : PATIENT_BLOCK) + TAIL;",
  "",
  "const messages = [{ role: 'system', content: SYSTEM }];",
  "for (const m of historyRaw) {",
  "  if (m.role === 'user' || m.role === 'assistant') {",
  "    messages.push({ role: m.role, content: m.content });",
  "  }",
  "}",
  "const last = messages[messages.length - 1];",
  "if (!last || last.role !== 'user' || last.content !== ctx.user_message) {",
  "  messages.push({ role: 'user', content: ctx.user_message });",
  "}",
  "",
  "return [{ json: Object.assign({}, ctx, { messages, next_appointment: nextAppt || null, is_new_lead: isNewLead }) }];",
].join('\n');

const NEW_BUILD_CONTEXT = [
  "const resolved = $input.item.json;",
  "const extracted = $('Extraer datos del mensaje').item.json;",
  "const row = Array.isArray(resolved) ? resolved[0] : resolved;",
  "if (!row || !row.tenant_id) {",
  "  return [{ json: { skip: true, reason: 'no tenant resolvable', phone: extracted.phone } }];",
  "}",
  "return [{ json: {",
  "  tenant_id: row.tenant_id,",
  "  patient_id: row.patient_id,",
  "  patient_name: row.patient_name || 'Hola',",
  "  conversation_id: row.conversation_id,",
  "  is_new_lead: row.is_new_lead === true,",
  "  phone: extracted.phone,",
  "  user_message: extracted.message,",
  "  evolution_message_id: extracted.evolution_message_id,",
  "} }];",
].join('\n');

(async () => {
  const wf = JSON.parse(fs.readFileSync(WF_FILE, 'utf8'));

  const promptNode = wf.nodes.find(n => n.id === 'build-prompt');
  promptNode.parameters.jsCode = NEW_PROMPT_CODE;

  const ctxNode = wf.nodes.find(n => n.id === 'build-context');
  ctxNode.parameters.jsCode = NEW_BUILD_CONTEXT;

  const hydrate = (s) => s
    .replace(/\{\{ ?\$env\.SUPABASE_URL ?\}\}/g, SUPABASE_URL)
    .replace(/\{\{ ?\$env\.SUPABASE_SERVICE_ROLE_KEY ?\}\}/g, SERVICE_ROLE)
    .replace(/\{\{ ?\$env\.EVOLUTION_BASE_URL ?\}\}/g, EVO_BASE)
    .replace(/\{\{ ?\$env\.EVOLUTION_API_KEY ?\}\}/g, EVO_KEY)
    .replace(/\{\{ ?\$env\.EVOLUTION_INSTANCE_ID ?\}\}/g, EVO_ID)
    .replace(/\{\{ ?\$env\.EVOLUTION_INSTANCE_NAME ?\}\}/g, EVO_NAME);

  wf.nodes = JSON.parse(hydrate(JSON.stringify(wf.nodes)));

  const oaIdx = wf.nodes.findIndex(n => n.id === 'openai');
  if (oaIdx >= 0) {
    wf.nodes[oaIdx] = {
      parameters: {
        resource: 'text',
        operation: 'message',
        modelId: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
        messages: { values: '={{ $json.messages }}' },
        simplify: false,
        options: { temperature: 0.5, maxTokens: 600 },
      },
      id: 'openai',
      name: 'OpenAI Chat',
      type: '@n8n/n8n-nodes-langchain.openAi',
      typeVersion: 1.8,
      position: wf.nodes[oaIdx].position,
      credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
    };
  }

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || { executionOrder: 'v1' },
  };

  const r = await fetch(N + '/api/v1/workflows/' + WF_ID, {
    method: 'PUT',
    headers: { 'X-N8N-API-KEY': T, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log('PUT →', r.status);
  if (r.ok) {
    await fetch(N + '/api/v1/workflows/' + WF_ID + '/activate', {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': T },
    });
    console.log('✅ Workflow actualizado y reactivado');
  } else {
    console.log(await r.text());
  }
})();
