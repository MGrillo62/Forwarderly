const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log("=== COMPANIES (Empresa) ===");
  const companies = await prisma.empresa.findMany();
  for (const c of companies) {
    console.log(`- ID: ${c.id}, RUC: ${c.ruc}, RazonSocial: ${c.razonSocial}, ultimoNroCotizacion: ${c.ultimoNroCotizacion}`);
  }

  console.log("\n=== ALL COTIZACIONES ===");
  const cots = await prisma.cotizacion.findMany({
    include: {
      cliente: true,
      lead: true,
      empresa: true
    }
  });
  console.log(`Total Cotizaciones in DB: ${cots.length}`);
  for (const c of cots) {
    const clientName = c.cliente ? c.cliente.razonSocial : (c.lead ? c.lead.nombre || c.lead.razonSocial || c.lead.contacto : "N/A");
    console.log(`- ID: ${c.id}, Numero: ${c.numero}, Empresa: ${c.empresa.razonSocial} (ID: ${c.empresaId}), Cliente/Prospecto: ${clientName}, CreatedAt: ${c.createdAt.toISOString()}`);
  }

  console.log("\n=== ALL ORDENES ===");
  const ords = await prisma.orden.findMany({
    include: {
      cotizacion: {
        include: { empresa: true }
      }
    }
  });
  console.log(`Total Ordenes in DB: ${ords.length}`);
  for (const o of ords) {
    const empName = o.cotizacion && o.cotizacion.empresa ? o.cotizacion.empresa.razonSocial : "N/A";
    console.log(`- ID: ${o.id}, Correlativo: ${o.correlativo}, Anio: ${o.anio}, Empresa: ${empName}`);
  }
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
