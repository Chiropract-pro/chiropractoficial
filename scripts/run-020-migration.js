import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '020_billing_dian.sql');
  await withClient(async (client) => {
    console.log('▶ Aplicando 020_billing_dian.sql...');
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('✅ Migración aplicada.\n');
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'tenant_billing_config';`);
    console.log('📊 Tabla:'); tables.forEach((r) => console.log(`   - ${r.table_name}`));

    const { rows: cols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales' AND column_name LIKE 'e_invoice%'
      ORDER BY column_name;`);
    console.log('\n💳 Campos sales:'); cols.forEach((r) => console.log(`   - ${r.column_name}`));

    const { rows: pcols } = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'patients' AND column_name IN ('id_type', 'id_number');`);
    console.log('\n🆔 Campos patients:'); pcols.forEach((r) => console.log(`   - ${r.column_name}`));

    const { rows: fns } = await client.query(`
      SELECT proname FROM pg_proc
      WHERE pronamespace = 'public'::regnamespace
        AND proname IN ('tenant_billing_config_upsert', 'get_billing_config_for_emit', 'get_sale_for_emit')
      ORDER BY proname;`);
    console.log('\n🔧 RPCs:'); fns.forEach((r) => console.log(`   - ${r.proname}`));
  });
}
run().catch((err) => { console.error('❌', err.message); process.exit(1); });
