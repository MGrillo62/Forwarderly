import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding test data for M&V Investments...");

  // 1. Create company M&V Investments
  const ruc = '20123456789';
  const company = await prisma.empresa.upsert({
    where: { ruc },
    update: {},
    create: {
      ruc,
      razonSocial: 'M&V Investments',
      contacto: 'Carlos Velez',
      celular: '+51 999 999 999',
      correo: 'carlos.velez@mvinvest.com',
      fechaInicio: new Date(),
      estado: 'ACTIVO',
      diasPrueba: 14,
      montoSuscripcion: 100.00
    }
  });
  console.log(`- Created/found Company: ${company.razonSocial} (ID: ${company.id})`);

  // 2. Create a seller user for this company
  const hashedPassword = await bcrypt.hash('seller123', 10);
  const seller = await prisma.usuario.upsert({
    where: { username: 'mvseller' },
    update: { empresaId: company.id },
    create: {
      username: 'mvseller',
      password: hashedPassword,
      nombres: 'MV',
      apellidos: 'Seller',
      correo: 'seller@mvinvest.com',
      rol: 'VENDEDOR',
      empresaId: company.id,
      estado: 'ACTIVO'
    }
  });
  console.log(`- Created/found Seller: ${seller.username} (ID: ${seller.id})`);

  // 3. Create a client for this company
  const client = await prisma.cliente.upsert({
    where: { ruc_empresaId: { ruc: '20888888888', empresaId: company.id } },
    update: {},
    create: {
      ruc: '20888888888',
      razonSocial: 'MV Client S.A.C.',
      direccion: 'Av. Larco 123, Miraflores',
      contacto: 'Jorge Luis',
      celular: '+51 988 888 888',
      correo: 'jorge@mvclient.com',
      empresaId: company.id
    }
  });
  console.log(`- Created/found Client: ${client.razonSocial} (ID: ${client.id})`);

  // 4. Delete existing quotes/orders for this company to start fresh
  const existingCots = await prisma.cotizacion.findMany({ where: { empresaId: company.id } });
  const existingCotIds = existingCots.map(c => c.id);
  await prisma.orden.deleteMany({ where: { cotizacionId: { in: existingCotIds } } });
  await prisma.cotizacionLinea.deleteMany({ where: { cotizacionId: { in: existingCotIds } } });
  await prisma.cotizacionEstadoHistorial.deleteMany({ where: { cotizacionId: { in: existingCotIds } } });
  await prisma.cotizacion.deleteMany({ where: { empresaId: company.id } });
  console.log("- Cleared existing quotes and orders for M&V Investments.");

  // 5. Create 3 Cotizaciones with numbers 11, 13, 15
  const cot11 = await prisma.cotizacion.create({
    data: {
      numero: 11,
      estado: 'APROBADA',
      clienteId: client.id,
      vendedorId: seller.id,
      empresaId: company.id,
      moneda: 'USD',
      totalVenta: 1000,
      igv: 180,
      precioTotal: 1180,
      utilidad: 200,
      porcentajeUtilidad: 20
    }
  });

  const cot13 = await prisma.cotizacion.create({
    data: {
      numero: 13,
      estado: 'APROBADA',
      clienteId: client.id,
      vendedorId: seller.id,
      empresaId: company.id,
      moneda: 'USD',
      totalVenta: 2000,
      igv: 360,
      precioTotal: 2360,
      utilidad: 400,
      porcentajeUtilidad: 20
    }
  });

  const cot15 = await prisma.cotizacion.create({
    data: {
      numero: 15,
      estado: 'APROBADA',
      clienteId: client.id,
      vendedorId: seller.id,
      empresaId: company.id,
      moneda: 'USD',
      totalVenta: 3000,
      igv: 540,
      precioTotal: 3540,
      utilidad: 600,
      porcentajeUtilidad: 20
    }
  });
  console.log("- Created Cotizaciones: #11, #13, #15.");

  // 6. Create 3 Ordenes with correlativos 7, 8, 10
  const ord7 = await prisma.orden.create({
    data: {
      cotizacionId: cot11.id,
      correlativo: 7,
      anio: 2026,
      estado: 'COORDINACION_EMBARQUE'
    }
  });

  const ord8 = await prisma.orden.create({
    data: {
      cotizacionId: cot13.id,
      correlativo: 8,
      anio: 2026,
      estado: 'COORDINACION_EMBARQUE'
    }
  });

  const ord10 = await prisma.orden.create({
    data: {
      cotizacionId: cot15.id,
      correlativo: 10,
      anio: 2026,
      estado: 'COORDINACION_EMBARQUE'
    }
  });
  console.log("- Created Ordenes correlatives: #7, #8, #10.");

  console.log("Seeding test data completed successfully.");
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
