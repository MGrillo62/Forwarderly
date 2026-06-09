const { Client } = require('pg');

const combinations = [
  { user: 'postgres', pass: 'postgres', db: 'neondb' },
  { user: 'postgres', pass: 'postgres', db: 'postgres' },
  { user: 'postgres', pass: 'postgres', db: 'forwarderly' },
  { user: 'postgres', pass: 'admin', db: 'postgres' },
  { user: 'postgres', pass: 'admin', db: 'forwarderly' },
  { user: 'postgres', pass: 'admin', db: 'neondb' },
  { user: 'postgres', pass: '', db: 'postgres' }
];

async function tryConnect(c) {
  const connectionString = `postgresql://${c.user}:${c.pass}@localhost:5432/${c.db}`;
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log(`Successfully connected to: postgresql://${c.user}:***@localhost:5432/${c.db}`);
    return client;
  } catch (err) {
    // console.log(`Failed: ${connectionString} - ${err.message}`);
    return null;
  }
}

async function main() {
  let client = null;
  for (const c of combinations) {
    client = await tryConnect(c);
    if (client) break;
  }

  if (!client) {
    console.log("Could not connect to local PostgreSQL on 5432 with common credentials.");
    return;
  }

  try {
    // List tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);
    console.log("Tables:", tablesRes.rows.map(r => r.table_name).join(", "));

    // Check if Empresa exists and query it
    const hasEmpresa = tablesRes.rows.some(r => r.table_name.toLowerCase() === 'empresa');
    if (hasEmpresa) {
      const empRes = await client.query('SELECT * FROM "Empresa"');
      console.log(`\nCompanies found (${empRes.rows.length}):`);
      for (const row of empRes.rows) {
        console.log(`- ID: ${row.id}, RUC: ${row.ruc}, RazonSocial: ${row.razonSocial}, ultimoNroCotizacion: ${row.ultimoNroCotizacion}`);
      }

      // Check if Cotizacion exists and query it
      const hasCot = tablesRes.rows.some(r => r.table_name.toLowerCase() === 'cotizacion');
      if (hasCot) {
        const cotRes = await client.query('SELECT * FROM "Cotizacion"');
        console.log(`\nQuotations found (${cotRes.rows.length}):`);
        for (const row of cotRes.rows) {
          console.log(`- ID: ${row.id}, Numero: ${row.numero}, EmpresaId: ${row.empresaId}`);
        }
      }

      // Check if Orden exists and query it
      const hasOrd = tablesRes.rows.some(r => r.table_name.toLowerCase() === 'orden');
      if (hasOrd) {
        const ordRes = await client.query('SELECT * FROM "Orden"');
        console.log(`\nOrders found (${ordRes.rows.length}):`);
        for (const row of ordRes.rows) {
          console.log(`- ID: ${row.id}, Correlativo: ${row.correlativo}`);
        }
      }
    }
  } catch (err) {
    console.error("Error querying local DB:", err.message);
  } finally {
    await client.end();
  }
}

main();
