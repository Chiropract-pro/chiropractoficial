// Setea las env vars VITE_* del frontend en Vercel para production+preview.
// Uso: node --env-file=.env scripts/vercel-env-set.js

import { spawn } from 'node:child_process';

const VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_PUBLIC_SITE_URL',
  'VITE_CLINIC_NAME',
  'VITE_CLINIC_DOCTOR',
  'VITE_CLINIC_PHONE',
  'VITE_CLINIC_PHONE_DISPLAY',
  'VITE_WOMPI_PUBLIC_KEY',
];

const ENVS = ['production', 'preview'];

function run(cmd, args, stdin) {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    c.stdout.on('data', (d) => out += d);
    c.stderr.on('data', (d) => err += d);
    if (stdin !== undefined) c.stdin.write(stdin);
    c.stdin.end();
    c.on('close', (code) => resolve({ code, out, err }));
  });
}

(async () => {
  for (const v of VARS) {
    const value = process.env[v];
    if (!value) {
      console.log('  ⚠  ' + v + ' no en .env, skip');
      continue;
    }
    for (const env of ENVS) {
      // Remove existing (idempotente, falla silencioso si no existe)
      await run('vercel', ['env', 'rm', v, env, '--yes']);
      // Add con stdin
      const r = await run('vercel', ['env', 'add', v, env], value);
      if (r.code !== 0) {
        console.log('  ❌ ' + v + ' ' + env + ': ' + (r.err || r.out).slice(0, 150));
      }
    }
    console.log('  ✅ ' + v);
  }
  console.log('\n✅ Done');
})();
