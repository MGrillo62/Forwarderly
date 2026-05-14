import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const clientes = await prisma.cliente.findMany({ where: { empresaId } });
  res.json(clientes);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const cliente = await prisma.cliente.create({ data: { ...req.body, empresaId } });
  res.json(cliente);
});

export default router;
