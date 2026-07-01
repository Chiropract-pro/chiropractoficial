import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '018_clinical_files.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await withClient(async (client) => {
    console.log('▶ Aplicando 018_clinical_files.sql...');
    await client.query(sql);
    console.log('✅ Migración aplicada.\n');

    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'clinical_files';
    `);
    console.log('📊 Tabla creada:'); tables.forEach((r) => console.log(`   - ${r.table_name}`));

    const { rows: bucket } = await client.query(`SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'clinical-files';`);
    console.log('\n🪣 Bucket:'); bucket.forEach((r) => console.log(`   - ${r.id} (public=${r.public}, limit=${r.file_size_limit})`));

    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('clinical_file_register', 'clinical_file_archive', 'clinical_file_get')
      ORDER BY proname;
    `);
    console.log('\n🔧 RPCs:'); fns.forEach((r) => console.log(`   - ${r.proname}`));
  });
}
run().catch((err) => { console.error('❌ Error:', err.message); process.exit(1); });
