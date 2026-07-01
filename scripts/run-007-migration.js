import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const client = await pool.connect();
  try {
    console.log('Aplicando 007_whatsapp_and_rag.sql...');
    const sql = fs.readFileSync(
      path.join(__dirname, '..', 'supabase', 'migrations', '007_whatsapp_and_rag.sql'),
      'utf8'
    );
    await client.query(sql);
    console.log('✅ Migration aplicada\n');

    const tables = ['whatsapp_conversations', 'whatsapp_messages', 'notification_jobs', 'notification_templates', 'clinical_embeddings'];
    const { rows: created } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      ORDER BY table_name;
    `, [tables]);
    console.log('Tablas creadas:');
    created.forEach(r => console.log(`  ✅ ${r.table_name}`));

    const { rows: ext } = await client.query(`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`);
    console.log('\nExtensión pgvector:', ext.length > 0 ? `✅ ${ext[0].extversion}` : '❌ no instalada');

    const funcs = ['schedule_appointment_reminders', 'next_appointment_by_phone', 'match_clinical_embeddings', 'update_conversation_last_message', 'auto_schedule_reminders'];
    const { rows: funcRows } = await client.query(`
      SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND proname = ANY($1::text[])
      ORDER BY proname;
    `, [funcs]);
    console.log('\nFunciones helper:');
    funcRows.forEach(r => console.log(`  ✅ ${r.proname}`));
  } catch (err) {
    console.error('❌ Error:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
