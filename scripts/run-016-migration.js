// Aplica migración 016_patient_self_service.sql
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '016_patient_self_service.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withClient(async (client) => {
    console.log('▶ Aplicando 016_patient_self_service.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada.\n');

    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = 'jornada_id';
    `);
    console.log('📊 Columna agregada:');
    cols.forEach((r) => console.log(`   - appointments.${r.column_name}`));

    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('patient_update_profile', 'patient_list_jornadas', 'patient_book_jornada')
      ORDER BY proname;
    `);
    console.log('\n🔧 RPCs nuevas:');
    fns.forEach((r) => console.log(`   - ${r.proname}`));
  });
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
