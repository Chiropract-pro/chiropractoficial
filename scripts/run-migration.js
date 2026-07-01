import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './_db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
  const client = await pool.connect();
  try {
    // First, clean up any partial migration state
    console.log('Cleaning up partial migration state...');
    
    // Drop the supabase_migrations schema table entry if it exists
    await client.query(`
      DELETE FROM supabase_migrations.schema_migrations 
      WHERE statement_hash IS NOT NULL;
    `).catch(() => console.log('No migration history to clean'));

    // Now run the full schema
    console.log('Running full schema setup...');
    const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    await client.query(sql);
    console.log('✅ Schema created successfully!');
    
    // Run fix migration
    console.log('Running fix migration...');
    const fixPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_fix_schema.sql');
    const fixSql = fs.readFileSync(fixPath, 'utf8');
    await client.query(fixSql);
    console.log('✅ Fix migration applied successfully!');

    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    console.log('\n📊 Tables created:');
    rows.forEach(r => console.log(`  - ${r.table_name}`));

  } catch (err) {
    console.error('❌ Error:', err.message);
    // Try running just the fix
    console.log('\nAttempting to run just the fix migration...');
    try {
      const fixPath = path.join(__dirname, '..', 'supabase', 'migrations', '002_fix_schema.sql');
      const fixSql = fs.readFileSync(fixPath, 'utf8');
      await client.query(fixSql);
      console.log('✅ Fix migration applied!');
    } catch (fixErr) {
      console.error('❌ Fix also failed:', fixErr.message);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

run();
