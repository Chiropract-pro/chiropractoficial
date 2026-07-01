import { pool } from './_db.js';

async function run() {
  const client = await pool.connect();
  try {
    // Add INSERT policy for tenant_memberships so owners can add members
    await client.query(`
      CREATE POLICY "Owners can insert memberships" ON tenant_memberships
        FOR INSERT WITH CHECK (
          EXISTS (SELECT 1 FROM tenant_memberships WHERE role IN ('owner', 'admin') AND user_id = auth.uid() AND tenant_id = tenant_memberships.tenant_id)
        );
    `);
    console.log('✅ Added membership INSERT policy');

    // Also add a policy that allows a user to create their first membership when they have none
    // (needed for onboarding - user creates tenant + their own membership in one transaction)
    await client.query(`
      CREATE POLICY "Users can insert own membership" ON tenant_memberships
        FOR INSERT WITH CHECK (user_id = auth.uid());
    `);
    console.log('✅ Added own-membership INSERT policy');

    // Allow users to update their own profile's default_tenant_id
    // (needed for onboarding flow)
    await client.query(`
      CREATE POLICY "Users can insert own profile" ON profiles
        FOR INSERT WITH CHECK (id = auth.uid());
    `);
    console.log('✅ Added profile INSERT policy');

    // Enable email auth in Supabase (this is done via dashboard, but let's verify)
    console.log('\n📋 Next steps:');
    console.log('1. Go to Supabase Dashboard → Authentication → Providers');
    console.log('2. Ensure Email provider is enabled');
    console.log('3. Set Site URL to your app URL');
    console.log('4. Disable "Confirm email" for testing (optional)');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
