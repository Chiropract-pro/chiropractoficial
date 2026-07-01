import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runMigration(client, file) {
  console.log(`\nAplicando ${file}...`);
  const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', file), 'utf8');
  await client.query(sql);
  console.log(`✅ ${file} aplicada`);
}

async function run() {
  const client = await pool.connect();
  try {
    await runMigration(client, '005_security_hardening.sql');
    await runMigration(client, '006_create_tenant_rpc.sql');

    console.log('\nVerificando funciones SECURITY DEFINER:');
    const { rows: funcs } = await client.query(`
      SELECT p.proname, p.prosecdef, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('is_tenant_member', 'handle_new_user', 'decrement_product_stock', 'sale_item_tenant_check', 'validate_default_tenant', 'create_tenant_with_owner')
      ORDER BY p.proname;
    `);
    funcs.forEach(r => {
      const hasSearchPath = (r.proconfig || []).some(c => c.startsWith('search_path='));
      console.log(`  ${r.proname}: SECURITY DEFINER=${r.prosecdef} search_path=${hasSearchPath ? '✅' : '❌'}`);
    });

    console.log('\nVerificando policies de tenants y memberships:');
    const { rows: policies } = await client.query(`
      SELECT tablename, policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('tenants', 'tenant_memberships', 'sale_items')
      ORDER BY tablename, cmd, policyname;
    `);
    policies.forEach(r => console.log(`  ${r.tablename} [${r.cmd}]: ${r.policyname}`));

    console.log('\nVerificando sale_items.tenant_id:');
    const { rows: cols } = await client.query(`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sale_items' AND column_name = 'tenant_id';
    `);
    cols.forEach(r => console.log(`  ${r.column_name}: nullable=${r.is_nullable}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
