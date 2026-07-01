import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '019_patient_clinical_view.sql');
  await withClient(async (client) => {
    console.log('▶ Aplicando 019_patient_clinical_view.sql...');
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('✅ Migración aplicada.\n');
    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('patient_get_clinical_history', 'patient_get_file_storage_path')
      ORDER BY proname;`);
    console.log('🔧 RPCs:'); fns.forEach((r) => console.log(`   - ${r.proname}`));
  });
}
run().catch((err) => { console.error('❌', err.message); process.exit(1); });
