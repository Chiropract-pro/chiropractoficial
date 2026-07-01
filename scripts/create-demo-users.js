// Crea usuarios de prueba en chiropract.co con email confirmado.
// Uso: node --env-file=.env scripts/create-demo-users.js

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('❌ Falta VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Chiropract2026!';

const USERS = [
  // Principal: Dr. Miguel Ángel Díaz (owner del tenant principal)
  {
    email: 'miguel@chiropract.co',
    full_name: 'Dr. Miguel Ángel Díaz',
    phone: '+573176305076',
    role: 'owner',
    join_tenant_slug: 'quiropraxia-diaz', // se une al existente como owner
  },
  // Recepcionista del consultorio del Dr. Díaz
  {
    email: 'recepcion@chiropract.co',
    full_name: 'Sandra Martínez',
    role: 'admin',
    join_tenant_slug: 'quiropraxia-diaz',
  },
  // Otro profesional del consultorio
  {
    email: 'dra.maria@chiropract.co',
    full_name: 'Dra. María González',
    role: 'doctor',
    join_tenant_slug: 'quiropraxia-diaz',
  },
  // Cuenta de demo separada para que prospects prueben todo el flow desde cero
  {
    email: 'demo@chiropract.co',
    full_name: 'Demo Owner',
    role: 'owner',
    create_own_tenant: true,
    tenant_data: {
      name: 'Consultorio Demo',
      slug: 'demo-chiropract',
      city: 'Bogotá',
      phone: '+573000000000',
    },
  },
];

async function findOrCreateUser(u) {
  console.log(`\n[${u.email}]`);

  // Verificar si ya existe
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list.users.find((x) => x.email === u.email);

  let userId;
  if (existing) {
    console.log(`  ↻ Ya existe → ${existing.id}`);
    userId = existing.id;
  } else {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });
    if (cErr) {
      console.log('  ❌ Create error:', cErr.message);
      return null;
    }
    userId = created.user.id;
    console.log(`  ✅ Usuario creado: ${userId}`);
  }

  // Profile (idempotente)
  await admin.from('profiles').upsert({
    id: userId,
    full_name: u.full_name,
    phone: u.phone || null,
  });

  // Owner de tenant nuevo
  if (u.create_own_tenant) {
    const { data: t, error: tErr } = await admin
      .from('tenants')
      .upsert(
        {
          name: u.tenant_data.name,
          slug: u.tenant_data.slug,
          owner_email: u.email,
          owner_name: u.full_name,
          city: u.tenant_data.city,
          phone: u.tenant_data.phone,
          plan: 'trial',
        },
        { onConflict: 'slug' }
      )
      .select()
      .single();
    if (tErr) {
      console.log('  ❌ Tenant error:', tErr.message);
    } else {
      await admin.from('tenant_memberships').upsert(
        {
          user_id: userId,
          tenant_id: t.id,
          role: 'owner',
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tenant_id' }
      );
      await admin.from('profiles').update({ default_tenant_id: t.id }).eq('id', userId);
      console.log(`  ✅ Owner del tenant ${u.tenant_data.slug}`);
    }
  }

  // Unirse a tenant existente
  if (u.join_tenant_slug) {
    const { data: t } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', u.join_tenant_slug)
      .single();
    if (!t) {
      console.log(`  ❌ Tenant ${u.join_tenant_slug} no existe`);
    } else {
      await admin.from('tenant_memberships').upsert(
        {
          user_id: userId,
          tenant_id: t.id,
          role: u.role,
          accepted_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,tenant_id' }
      );
      await admin.from('profiles').update({ default_tenant_id: t.id }).eq('id', userId);

      // Si es el owner principal del tenant, actualizar owner_email/name del tenant
      if (u.role === 'owner') {
        await admin
          .from('tenants')
          .update({ owner_email: u.email, owner_name: u.full_name })
          .eq('id', t.id);
      }
      console.log(`  ✅ ${u.role} en ${u.join_tenant_slug}`);
    }
  }

  return { email: u.email, userId, role: u.role };
}

(async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('Creando usuarios de prueba @chiropract.co');
  console.log('═══════════════════════════════════════════════════════');

  const results = [];
  for (const u of USERS) {
    const r = await findOrCreateUser(u);
    if (r) results.push(r);
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════╗');
  console.log('║                    CREDENCIALES DE PRUEBA                 ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nContraseña común para todos: ${PASSWORD}\n`);
  console.log('Usuarios:');
  results.forEach((r) => console.log(`  • ${r.email.padEnd(35)} → ${r.role}`));
  console.log('\nLogin en: https://chiropract-co-mauve.vercel.app/#crm');
})();
