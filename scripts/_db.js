// Helper compartido para conexión a Postgres desde scripts.
// Lee SUPABASE_DB_URL del entorno (.env). Nunca hardcodear credenciales.

import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Falta SUPABASE_DB_URL en el entorno.');
  console.error('   Define la variable en .env y corre con:  node --env-file=.env scripts/<script>.js');
  process.exit(1);
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

export async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
    await pool.end();
  }
}
