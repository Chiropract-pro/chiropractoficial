import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const client = await pool.connect();
  try {
    console.log('Aplicando migration 004_stock_atomic.sql...');
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '004_stock_atomic.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migration aplicada');

    const { rows } = await client.query(`
      SELECT routine_name, routine_type FROM information_schema.routines
      WHERE routine_schema = 'public' AND routine_name = 'decrement_product_stock';
    `);
    rows.forEach(r => console.log(`  ✅ ${r.routine_type}: ${r.routine_name}`));
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
