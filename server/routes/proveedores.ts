import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const proveedores = await prisma.proveedor.findMany({ where: { empresaId } });
  res.json(proveedores);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const proveedor = await prisma.proveedor.create({ data: { ...req.body, empresaId } });
  res.json(proveedor);
});

export default router;
