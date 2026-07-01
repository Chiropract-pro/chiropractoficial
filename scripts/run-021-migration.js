import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '021_patient_sale_invoice.sql');
  await withClient(async (client) => {
    console.log('▶ Aplicando 021_patient_sale_invoice.sql...');
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('✅ patient_get_sale actualizada');
  });
}
run().catch((err) => { console.error('❌', err.message); process.exit(1); });
