import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const NEW_TABLES = ['services', 'products', 'jornada_offerings', 'sales', 'sale_items'];

async function run() {
  const client = await pool.connect();
  try {
    console.log('Verificando si las tablas ya existen...');
    const { rows: existing } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[]);
    `, [NEW_TABLES]);

    if (existing.length > 0) {
      console.log('⚠️  Tablas que ya existen:', existing.map(r => r.table_name).join(', '));
      console.log('Abortando para evitar pisar datos. Bórralas manualmente si quieres re-correr.');
      return;
    }

    console.log('Aplicando migration 003_products_services.sql...');
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '003_products_services.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migration aplicada');

    console.log('\nVerificando tablas creadas:');
    const { rows: created } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1::text[])
      ORDER BY table_name;
    `, [NEW_TABLES]);
    created.forEach(r => console.log(`  ✅ ${r.table_name}`));

    console.log('\nVerificando RLS policies:');
    const { rows: policies } = await client.query(`
      SELECT tablename, COUNT(*)::int as count
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = ANY($1::text[])
      GROUP BY tablename
      ORDER BY tablename;
    `, [NEW_TABLES]);
    policies.forEach(r => console.log(`  ${r.tablename}: ${r.count} policies`));

    console.log('\nVerificando índices:');
    const { rows: indexes } = await client.query(`
      SELECT tablename, indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = ANY($1::text[])
      ORDER BY tablename, indexname;
    `, [NEW_TABLES]);
    indexes.forEach(r => console.log(`  ${r.tablename}: ${r.indexname}`));

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
