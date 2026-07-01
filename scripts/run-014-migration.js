// Aplica migración 014_patient_sessions.sql
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '014_patient_sessions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withClient(async (client) => {
    console.log('▶ Aplicando 014_patient_sessions.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada.\n');

    // Verificar tablas
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('patient_otp_codes', 'patient_sessions')
      ORDER BY table_name;
    `);
    console.log('📊 Tablas creadas:');
    tables.forEach((r) => console.log(`   - ${r.table_name}`));

    // Verificar funciones
    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname LIKE 'patient_%'
      ORDER BY proname;
    `);
    console.log('\n🔧 RPCs disponibles:');
    fns.forEach((r) => console.log(`   - ${r.proname}`));
  });
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
