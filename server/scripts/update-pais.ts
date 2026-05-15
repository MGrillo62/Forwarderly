import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.cotizacion.updateMany({
    data: {
      pais: 'PERÚ'
    }
  });
  console.log(`Updated ${result.count} quotations to PERÚ`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
