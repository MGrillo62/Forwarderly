// File structure: I will implement each one as a skeleton to ensure imports work.
// empresas.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const empresas = await prisma.empresa.findMany();
  res.json(empresas);
});

router.post('/', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const empresa = await prisma.empresa.create({ data: req.body });
  res.json(empresa);
});

router.put('/:id', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const { id } = req.params;
  const empresa = await prisma.empresa.update({
    where: { id },
    data: req.body
  });
  res.json(empresa);
});

export default router;
