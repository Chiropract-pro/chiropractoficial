#!/usr/bin/env node
// ============================================================
// setup-resend.mjs — Configura los secretos de correo en Supabase.
//
// Uso (la key NUNCA se pasa como argumento visible ni se commitea):
//   RESEND_API_KEY=re_xxx \
//   SUPABASE_ACCESS_TOKEN=sbp_xxx \
//   EMAIL_FROM="chiropract.co <hola@chiropract.co>" \
//   node scripts/setup-resend.mjs
//
// Después, desplegar la función:
//   supabase functions deploy send-email --project-ref dqxffnibxizlfaeddzrz --use-api
// ============================================================

const REF = process.env.SUPABASE_PROJECT_REF || 'dqxffnibxizlfaeddzrz';
const ACCESS = process.env.SUPABASE_ACCESS_TOKEN;
const RESEND = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || 'chiropract.co <onboarding@resend.dev>';
const SITE = process.env.PUBLIC_SITE_URL || 'https://chiropract.co';

if (!ACCESS) { console.error('❌ Falta SUPABASE_ACCESS_TOKEN'); process.exit(1); }
if (!RESEND) { console.error('❌ Falta RESEND_API_KEY'); process.exit(1); }
if (!/^re_/.test(RESEND)) { console.error('⚠️  La key no parece de Resend (debería empezar con "re_")'); }

const secrets = [
  { name: 'RESEND_API_KEY', value: RESEND },
  { name: 'EMAIL_FROM', value: FROM },
  { name: 'PUBLIC_SITE_URL', value: SITE },
];

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/secrets`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(secrets),
});

if (res.ok) {
  // No imprimir valores — solo confirmar nombres.
  console.log('✅ Secretos configurados:', secrets.map((s) => s.name).join(', '));
  console.log(`   EMAIL_FROM = ${FROM}`);
  console.log('\nSiguiente paso — desplegar la función:');
  console.log(`   supabase functions deploy send-email --project-ref ${REF} --use-api`);
} else {
  console.error('❌ Error configurando secretos:', res.status, await res.text());
  process.exit(1);
}
