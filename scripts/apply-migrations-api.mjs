// Aplica todas las migraciones a la nueva cuenta Supabase via Management API.
// Uso: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... node scripts/apply-migrations-api.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF;

if (!TOKEN || !REF) {
  console.error('Falta SUPABASE_ACCESS_TOKEN o SUPABASE_PROJECT_REF');
  process.exit(1);
}

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function runSql(query) {
  const resp = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status}: ${text.slice(0, 500)}`);
  }
  return text;
}

async function main() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  console.log(`\n📦 ${files.length} migraciones encontradas\n`);

  let ok = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    process.stdout.write(`▶ ${file} ... `);
    try {
      await runSql(sql);
      console.log('✅');
      ok++;
    } catch (e) {
      console.log('❌');
      console.error(`   ${String(e.message).split('\n')[0]}`);
      // Continuar: algunas migraciones pueden fallar por idempotencia (objetos ya existentes)
    }
  }

  console.log(`\n✅ ${ok}/${files.length} migraciones aplicadas sin error.`);

  // Verificación: contar tablas y funciones
  console.log('\n🔍 Verificando schema...');
  const tables = await runSql(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_type='BASE TABLE';`);
  const funcs = await runSql(`select count(*)::int as n from pg_proc where pronamespace='public'::regnamespace;`);
  console.log(`   Tablas públicas: ${JSON.parse(tables)[0].n}`);
  console.log(`   Funciones (RPCs): ${JSON.parse(funcs)[0].n}`);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
