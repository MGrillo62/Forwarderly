import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
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

  console.log({ superAdmin });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
