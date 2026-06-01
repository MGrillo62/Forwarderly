import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const optimusPassword = await bcrypt.hash('optimus123', 10);
  
  // 1. Upsert Superadmin
  const superAdmin = await prisma.usuario.upsert({
    where: { username: 'superadmin' },
    update: {},
    create: {
      username: 'superadmin',
      password: hashedPassword,
      nombres: 'Super',
      apellidos: 'Admin',
      correo: 'admin@system.com',
      rol: 'SUPER_ADMIN',
    },
  });

  // 2. Upsert Optimus Company
  const empresaOptimus = await prisma.empresa.upsert({
    where: { ruc: '20600259751' },
    update: {
      razonSocial: 'Optimus Systems & Process EIRL',
      contacto: 'Martín Grillo',
      celular: '+51 981 519 853',
      correo: 'martin.grillo@optimussp.com',
      estado: 'ACTIVO'
    },
    create: {
      ruc: '20600259751',
      razonSocial: 'Optimus Systems & Process EIRL',
      contacto: 'Martín Grillo',
      celular: '+51 981 519 853',
      correo: 'martin.grillo@optimussp.com',
      fechaInicio: new Date(),
      estado: 'ACTIVO',
      diasPrueba: 14,
      montoSuscripcion: 155.00
    }
  });

  // 3. Upsert 'optimus' User
  const optimusUser = await prisma.usuario.upsert({
    where: { username: 'optimus' },
    update: {
      empresaId: empresaOptimus.id,
      correo: 'martin.grillo@optimussp.com',
      rol: 'ADMIN',
      estado: 'ACTIVO'
    },
    create: {
      username: 'optimus',
      password: optimusPassword,
      nombres: 'Martín',
      apellidos: 'Grillo',
      celular: '+51 981 519 853',
      correo: 'martin.grillo@optimussp.com',
      rol: 'ADMIN',
      empresaId: empresaOptimus.id,
      estado: 'ACTIVO'
    }
  });

  console.log({ superAdmin, empresaOptimus, optimusUser });
}

main()
  .catch((e) => {
    console.error(e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
