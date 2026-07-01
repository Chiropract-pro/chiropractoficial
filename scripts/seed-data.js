// Datos semilla para el consultorio del Dr. Miguel Ángel Díaz.
// Uso: node --env-file=.env scripts/seed-data.js [slug-del-tenant]
// Default: usa el primer tenant encontrado.

import { pool } from './_db.js';

const TENANT_SLUG = process.argv[2] || null;

const SERVICES = [
  { name: 'Primera consulta', description: 'Evaluación inicial completa con diagnóstico postural y plan de tratamiento personalizado.', category: 'consulta', price: 150000, duration_min: 60 },
  { name: 'Ajuste de seguimiento', description: 'Sesión de ajuste quiropráctico para pacientes en tratamiento.', category: 'tratamiento', price: 100000, duration_min: 30 },
  { name: 'Quiropraxia deportiva', description: 'Tratamiento especializado para deportistas: lesiones, rendimiento y recuperación.', category: 'tratamiento', price: 130000, duration_min: 45 },
  { name: 'Rehabilitación postural', description: 'Programa de corrección postural con técnicas avanzadas.', category: 'tratamiento', price: 120000, duration_min: 45 },
  { name: 'Tratamiento cervical/lumbar', description: 'Sesión enfocada en aliviar dolor cervical o lumbar.', category: 'tratamiento', price: 110000, duration_min: 40 },
  { name: 'Paquete 4 sesiones', description: 'Cuatro sesiones de seguimiento con descuento del 15%.', category: 'paquete', price: 340000, duration_min: 30 },
  { name: 'Evaluación diagnóstica', description: 'Diagnóstico funcional sin tratamiento. Ideal para segunda opinión.', category: 'evaluacion', price: 80000, duration_min: 30 },
];

const PRODUCTS = [
  { name: 'Almohada cervical ortopédica', description: 'Almohada de espuma viscoelástica para alineación cervical durante el sueño.', category: 'almohada', sku: 'ALM-CER-01', price: 180000, cost: 90000, stock: 12, low_stock_threshold: 3 },
  { name: 'Cinturón lumbar de soporte', description: 'Cinturón ergonómico para alivio de carga lumbar.', category: 'cinturon', sku: 'CIN-LUM-01', price: 120000, cost: 60000, stock: 18, low_stock_threshold: 5 },
  { name: 'Suplemento de magnesio (60 cápsulas)', description: 'Magnesio bisglicinato para relajación muscular y recuperación.', category: 'suplemento', sku: 'SUP-MAG-60', price: 75000, cost: 38000, stock: 25, low_stock_threshold: 8 },
  { name: 'Soporte cervical de viaje', description: 'Cojín cervical para viajes largos y oficina.', category: 'accesorio', sku: 'ACC-CER-01', price: 55000, cost: 25000, stock: 20, low_stock_threshold: 5 },
  { name: 'Pelota de masaje miofascial', description: 'Pelota de látex denso para auto-masaje y liberación miofascial.', category: 'accesorio', sku: 'ACC-MAS-01', price: 35000, cost: 15000, stock: 30, low_stock_threshold: 8 },
];

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const JORNADAS = [
  { city: 'Soatá', date: daysFromNow(14), capacity: 15, price_per_patient: 120000, status: 'programada', notes: 'Jornada mensual en Soatá. Reservar con anticipación.' },
  { city: 'Guamal', date: daysFromNow(28), capacity: 12, price_per_patient: 130000, status: 'programada', notes: 'Visita de seguimiento.' },
  { city: 'Muzo', date: daysFromNow(45), capacity: 10, price_per_patient: 140000, status: 'programada', notes: 'Jornada bimensual.' },
  { city: 'Garcés Navas', date: daysFromNow(60), capacity: 18, price_per_patient: 110000, status: 'programada', notes: 'Jornada en zona Garcés Navas, Bogotá.' },
];

async function findTenant(client) {
  if (TENANT_SLUG) {
    const { rows } = await client.query(`SELECT id, name, slug FROM tenants WHERE slug = $1`, [TENANT_SLUG]);
    if (rows.length === 0) {
      throw new Error(`No se encontró tenant con slug "${TENANT_SLUG}". Crea uno primero desde el onboarding.`);
    }
    return rows[0];
  }
  const { rows } = await client.query(`SELECT id, name, slug FROM tenants ORDER BY created_at LIMIT 1`);
  if (rows.length === 0) {
    throw new Error('No hay tenants en la base de datos. Crea uno primero desde el onboarding.');
  }
  return rows[0];
}

async function run() {
  const client = await pool.connect();
  try {
    const tenant = await findTenant(client);
    console.log(`Sembrando datos para tenant: ${tenant.name} (${tenant.slug}, ${tenant.id})\n`);

    const { rows: existingServices } = await client.query(
      `SELECT COUNT(*)::int as c FROM services WHERE tenant_id = $1`,
      [tenant.id]
    );
    if (existingServices[0].c > 0) {
      console.log(`⚠️  Tenant ya tiene ${existingServices[0].c} servicios. Abortando para no duplicar.`);
      console.log('   Si quieres re-sembrar, borra primero los datos manualmente.');
      return;
    }

    console.log('Insertando servicios...');
    for (const s of SERVICES) {
      await client.query(
        `INSERT INTO services (tenant_id, name, description, category, price, duration_min) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenant.id, s.name, s.description, s.category, s.price, s.duration_min]
      );
      console.log(`  ✅ ${s.name}`);
    }

    console.log('\nInsertando productos...');
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products (tenant_id, name, description, category, sku, price, cost, stock, low_stock_threshold) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tenant.id, p.name, p.description, p.category, p.sku, p.price, p.cost, p.stock, p.low_stock_threshold]
      );
      console.log(`  ✅ ${p.name} (stock ${p.stock})`);
    }

    console.log('\nInsertando jornadas...');
    for (const j of JORNADAS) {
      await client.query(
        `INSERT INTO jornadas (tenant_id, city, date, capacity, price_per_patient, status, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [tenant.id, j.city, j.date, j.capacity, j.price_per_patient, j.status, j.notes]
      );
      console.log(`  ✅ ${j.city} — ${j.date}`);
    }

    console.log('\n✅ Datos sembrados correctamente.');
    console.log(`   Servicios: ${SERVICES.length}`);
    console.log(`   Productos: ${PRODUCTS.length}`);
    console.log(`   Jornadas: ${JORNADAS.length}`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
