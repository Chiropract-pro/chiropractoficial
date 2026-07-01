import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '023_apply_wompi_subscriptions.sql');
  await withClient(async (client) => {
    console.log('▶ Aplicando 023_apply_wompi_subscriptions.sql...');
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('✅ apply_wompi_event + create_payment_intent actualizadas');
  });
}
run().catch((err) => { console.error('❌', err.message); process.exit(1); });
