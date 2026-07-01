// Importa los 2 workflows de chiropract.co a la instancia n8n del usuario.
// - Reemplaza {{ $env.X }} con valores reales antes del import (n8n no tiene
//   "variables" sin license Enterprise).
// - Usa credencial OpenAI existente "OpenAi account" para el bot.
// - Crea/reutiliza credencial Postgres "Supabase chiropract.co".
//
// Uso: node --env-file=.env scripts/import-n8n-workflows.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const N8N = process.env.N8N_BASE_URL;
const TOKEN = process.env.N8N_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
const EVO_BASE = process.env.EVOLUTION_BASE_URL;
const EVO_KEY = process.env.EVOLUTION_API_KEY;
const EVO_INSTANCE_ID = process.env.EVOLUTION_INSTANCE_ID;
const EVO_INSTANCE_NAME = 'Miguel Angel Diaz Quiropractico'; // verificado en /instance/fetchInstances

// Credencial OpenAI existente que tu user usa en otros workflows.
// "OpenAi account" — la más genérica, no atada a un cliente específico.
const OPENAI_CRED_ID = 'XlxKrDQAS1w750sv';
const OPENAI_CRED_NAME = 'OpenAi account';

async function n8n(method, path, body) {
  const r = await fetch(N8N + path, {
    method,
    headers: {
      'X-N8N-API-KEY': TOKEN,
      'Content-Type': 'application/json',
      'accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// Parsea SUPABASE_DB_URL para crear credencial Postgres
function parseDbUrl(url) {
  // postgresql://user:pass@host:port/db
  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+?)(\?.*)?$/);
  if (!m) throw new Error('Bad DB URL format');
  return {
    user: m[1],
    password: m[2],
    host: m[3],
    port: parseInt(m[4]),
    database: m[5].split('?')[0],
    ssl: 'require',
  };
}

async function findOrCreatePostgresCred() {
  const list = await n8n('GET', '/api/v1/credentials');
  const existing = (list.data || []).find(c => c.name === 'Supabase chiropract.co' && c.type === 'postgres');
  if (existing) {
    console.log(`  ↻ Credencial Postgres ya existe: ${existing.id}`);
    return existing.id;
  }
  const cfg = parseDbUrl(SUPABASE_DB_URL);
  const created = await n8n('POST', '/api/v1/credentials', {
    name: 'Supabase chiropract.co',
    type: 'postgres',
    data: cfg,
  });
  console.log(`  ✅ Credencial Postgres creada: ${created.id}`);
  return created.id;
}

function loadWorkflow(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'n8n-workflows', file), 'utf8'));
}

// Reemplaza placeholders en un nodo con valores reales
function hydrateNode(node) {
  // Convertir todos los strings con {{ $env.X }} a valor literal
  const json = JSON.stringify(node);
  const replaced = json
    .replace(/\{\{ ?\$env\.SUPABASE_URL ?\}\}/g, SUPABASE_URL)
    .replace(/\{\{ ?\$env\.SUPABASE_SERVICE_ROLE_KEY ?\}\}/g, SERVICE_ROLE)
    .replace(/\{\{ ?\$env\.EVOLUTION_BASE_URL ?\}\}/g, EVO_BASE)
    .replace(/\{\{ ?\$env\.EVOLUTION_API_KEY ?\}\}/g, EVO_KEY)
    .replace(/\{\{ ?\$env\.EVOLUTION_INSTANCE_ID ?\}\}/g, EVO_INSTANCE_ID)
    .replace(/\{\{ ?\$env\.EVOLUTION_INSTANCE_NAME ?\}\}/g, EVO_INSTANCE_NAME);
  return JSON.parse(replaced);
}

// Reemplaza el nodo OpenAI Chat (HTTP) por un nodo de langchain con credential
function patchBotWorkflow(wf) {
  // Encontrar el nodo "OpenAI Chat" actual (HTTP)
  const idx = wf.nodes.findIndex(n => n.id === 'openai');
  if (idx === -1) {
    console.log('  ⚠ no se encontró nodo openai, dejando como está');
    return wf;
  }
  const old = wf.nodes[idx];
  const replaced = {
    parameters: {
      resource: 'text',
      operation: 'message',
      modelId: { __rl: true, value: 'gpt-4o-mini', mode: 'list', cachedResultName: 'gpt-4o-mini' },
      messages: {
        values: '={{ $json.messages }}',
      },
      simplify: false,
      options: {
        temperature: 0.5,
        maxTokens: 600,
      },
    },
    id: 'openai',
    name: 'OpenAI Chat',
    type: '@n8n/n8n-nodes-langchain.openAi',
    typeVersion: 1.8,
    position: old.position,
    credentials: {
      openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME },
    },
  };
  wf.nodes[idx] = replaced;
  return wf;
}

async function importWorkflow(file, patcher) {
  console.log(`\n📦 Importando ${file}...`);
  let wf = loadWorkflow(file);
  // Hidratar valores en cada nodo
  wf.nodes = wf.nodes.map(hydrateNode);
  if (patcher) wf = patcher(wf);

  // n8n's POST /workflows espera un payload limpio, sin id ni active
  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: wf.settings || { executionOrder: 'v1' },
  };

  // Verificar si ya existe (por nombre)
  const existing = await n8n('GET', '/api/v1/workflows?limit=100');
  const dup = (existing.data || []).find(w => w.name === wf.name);
  if (dup) {
    console.log(`  ↻ Workflow ya existe (id ${dup.id}). Actualizando...`);
    const updated = await n8n('PUT', `/api/v1/workflows/${dup.id}`, payload);
    console.log(`  ✅ Actualizado: ${updated.id} (active: ${updated.active})`);
    return updated;
  }

  const created = await n8n('POST', '/api/v1/workflows', payload);
  console.log(`  ✅ Creado: ${created.id} (active: ${created.active})`);
  return created;
}

(async () => {
  console.log('=== Importación de workflows chiropract.co ===\n');
  console.log('ℹ Skip credencial Postgres (mis workflows usan HTTP a REST API, no la necesitan)');

  const wf1 = await importWorkflow('01-MAD-Quiropraxia-Reminders-Cron.json', null);
  const wf2 = await importWorkflow('02-MAD-Quiropraxia-Bot-Inbound.json', patchBotWorkflow);

  console.log('\n=== Resumen ===');
  console.log(`Workflow #1 (Reminders Cron) → ${wf1.id}`);
  console.log(`Workflow #2 (Bot Inbound)    → ${wf2.id}`);
  console.log('\nLos workflows se importaron en estado INACTIVO.');
  console.log('Próximos pasos manuales:');
  console.log('  1. Conectar WhatsApp del Dr. Díaz a Evolution (escanear QR)');
  console.log(`  2. Abrir workflow ${wf2.id} en n8n y verificar el webhook URL`);
  console.log('  3. Configurar Evolution para que ese webhook reciba MESSAGES_UPSERT');
  console.log('  4. Activar workflow #2 (bot)');
  console.log('  5. Activar workflow #1 (cron de recordatorios)');
})().catch(e => {
  console.error('❌ Error:', e.message);
  process.exitCode = 1;
});
