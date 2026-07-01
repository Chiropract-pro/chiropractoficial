// Aplica migración 015_patient_actions.sql
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '015_patient_actions.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  await withClient(async (client) => {
    console.log('▶ Aplicando 015_patient_actions.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada.\n');

    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'appointment_change_requests';
    `);
    console.log('📊 Tabla creada:');
    tables.forEach((r) => console.log(`   - ${r.table_name}`));

    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN (
          'patient_cancel_appointment',
          'patient_request_reschedule',
          'patient_get_sale'
        )
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
