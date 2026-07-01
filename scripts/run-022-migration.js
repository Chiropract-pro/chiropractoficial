import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { withClient } from './_db.js';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function run() {
  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '022_saas_subscriptions.sql');
  await withClient(async (client) => {
    console.log('▶ Aplicando 022_saas_subscriptions.sql...');
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('✅ OK\n');

    const { rows: plans } = await client.query(`SELECT id, name, price_cop_monthly FROM plans ORDER BY display_order;`);
    console.log('💰 Planes:');
    plans.forEach((p) => console.log(`   - ${p.id}: ${p.name} (${p.price_cop_monthly}/mes)`));

    const { rows: subs } = await client.query(`SELECT COUNT(*) AS n FROM tenant_subscriptions;`);
    console.log(`\n📊 Subscriptions: ${subs[0].n}`);

    const { rows: cur } = await client.query(`SELECT tenant_id, plan_id, status, current_period_end, days_remaining FROM tenant_current_subscription LIMIT 5;`);
    console.log('\n🎯 Suscripciones activas:');
    cur.forEach((s) => console.log(`   - tenant=${s.tenant_id?.slice(0,8)} plan=${s.plan_id} status=${s.status} días=${s.days_remaining}`));
  });
}
run().catch((err) => { console.error('❌', err.message); process.exit(1); });
