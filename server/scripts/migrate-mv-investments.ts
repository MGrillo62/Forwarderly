import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("Running migration for M&V Investments...");

  // 1. Find the company
  const companies = await prisma.empresa.findMany();
  const company = companies.find(c => 
    c.razonSocial.toLowerCase().includes("m&v") || 
    c.razonSocial.toLowerCase().includes("investments")
  );

  if (!company) {
    console.error("ERROR: M&V Investments company not found in database.");
    return;
  }
  console.log(`Found Company: ${company.razonSocial} (ID: ${company.id})`);

  // 2. Update Cotizaciones: 11 -> 1, 13 -> 2, 15 -> 3
  console.log("\nUpdating Cotizaciones...");
  const quoteUpdates = [
    { oldNum: 11, newNum: 1 },
    { oldNum: 13, newNum: 2 },
    { oldNum: 15, newNum: 3 }
  ];

  for (const update of quoteUpdates) {
    const quote = await prisma.cotizacion.findFirst({
      where: {
        empresaId: company.id,
        numero: update.oldNum
      }
    });

    if (quote) {
      await prisma.cotizacion.update({
        where: { id: quote.id },
        data: { numero: update.newNum }
      });
      console.log(`- Quote ID ${quote.id}: updated number from ${update.oldNum} to ${update.newNum}`);
    } else {
      console.log(`- Quote with number ${update.oldNum} not found.`);
    }
  }

  // 3. Update Ordenes: 7 -> 1, 8 -> 2, 10 -> 3
  console.log("\nUpdating Ordenes...");
  const orderUpdates = [
    { oldCorr: 7, newCorr: 1 },
    { oldCorr: 8, newCorr: 2 },
    { oldCorr: 10, newCorr: 3 }
  ];

  // We find orders linked to company's quotes, or orders associated with company's quotes
  const companyQuotes = await prisma.cotizacion.findMany({
    where: { empresaId: company.id }
  });
  const quoteIds = companyQuotes.map(q => q.id);

  for (const update of orderUpdates) {
    const order = await prisma.orden.findFirst({
      where: {
        correlativo: update.oldCorr,
        OR: [
          { cotizacionId: { in: quoteIds } },
          { cotizacionesAsociadas: { some: { empresaId: company.id } } }
        ]
      }
    });

    if (order) {
      await prisma.orden.update({
        where: { id: order.id },
        data: { correlativo: update.newCorr }
      });
      console.log(`- Order ID ${order.id}: updated correlativo from ${update.oldCorr} to ${update.newCorr}`);
    } else {
      console.log(`- Order with correlativo ${update.oldCorr} not found.`);
    }
  }

  // 4. Update Empresa numerators: Cotizaciones = 3, Ordenes = 3, Costeos = 4
  console.log("\nUpdating Empresa numerators...");
  const updatedCompany = await prisma.empresa.update({
    where: { id: company.id },
    data: {
      ultimoNroCotizacion: 3,
      ultimoNroOrden: 3,
      ultimoNroCosteo: 4
    }
  });

  console.log("Updated Company numerators in database:");
  console.log(`- ultimoNroCotizacion: ${updatedCompany.ultimoNroCotizacion} (Next quote: 4)`);
  console.log(`- ultimoNroOrden: ${updatedCompany.ultimoNroOrden} (Next order: 4)`);
  console.log(`- ultimoNroCosteo: ${updatedCompany.ultimoNroCosteo} (Next costing: 5)`);

  console.log("\nMigration completed successfully!");
}

main()
  .catch(e => {
    console.error("Migration failed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
