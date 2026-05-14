import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.usuario.findFirst({ where: { rol: 'ADMIN' } }).then(console.log).finally(() => p.$disconnect());
