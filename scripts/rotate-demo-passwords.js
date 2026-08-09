// Rota la contraseña de los usuarios de prueba/staff en Supabase Auth.
// Necesario porque 'Chiropract2026!' quedó publicada en el historial del repo público.
//
// Uso:
//   SUPABASE_SERVICE_ROLE_KEY="..." \
//   VITE_SUPABASE_URL="https://dqxffnibxizlfaeddzrz.supabase.co" \
//   DEMO_USER_PASSWORD="$(openssl rand -base64 18)" \
//   node scripts/rotate-demo-passwords.js
//
// Imprime la nueva contraseña UNA vez al final para que la guardes en tu gestor.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEW_PASSWORD = process.env.DEMO_USER_PASSWORD;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!NEW_PASSWORD || NEW_PASSWORD.length < 12) {
  console.error('❌ Falta DEMO_USER_PASSWORD (mínimo 12 caracteres). Genera una fuerte y única.');
  process.exit(1);
}

const EMAILS = [
  'miguel@chiropract.co',
  'recepcion@chiropract.co',
  'dra.maria@chiropract.co',
  'demo@chiropract.co',
];

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  console.log('Rotando contraseñas de usuarios staff/demo…\n');

  // listUsers pagina de a 50 por defecto; con pocos usuarios basta la 1ª página,
  // pero paginamos por si el proyecto crece.
  const found = new Map();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error('❌ listUsers:', error.message); process.exit(1); }
    for (const u of data.users) {
      if (EMAILS.includes(u.email)) found.set(u.email, u.id);
    }
    if (data.users.length < 200) break;
  }

  let ok = 0;
  for (const email of EMAILS) {
    const id = found.get(email);
    if (!id) { console.log(`  ⚠️  ${email} — no existe (omitido)`); continue; }
    const { error } = await admin.auth.admin.updateUserById(id, { password: NEW_PASSWORD });
    if (error) { console.log(`  ❌ ${email} — ${error.message}`); continue; }
    console.log(`  ✅ ${email} — contraseña rotada`);
    ok++;
  }

  console.log(`\n${ok}/${EMAILS.length} usuarios actualizados.`);
  console.log('\n────────────────────────────────────────────');
  console.log('Nueva contraseña (guárdala en tu gestor y NO la subas al repo):');
  console.log(`  ${NEW_PASSWORD}`);
  console.log('────────────────────────────────────────────');
})();
