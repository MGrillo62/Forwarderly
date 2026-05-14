// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const categorias = await prisma.categoria.findMany({
    where: { empresaId },
    include: { conceptos: true }
  });
  res.json(categorias);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const { nombre } = req.body;
  const categoria = await prisma.categoria.create({
    data: { nombre, empresaId }
  });
  res.json(categoria);
});

router.post('/:id/conceptos', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { nombre, incluirPorDefecto } = req.body;
  const concepto = await prisma.concepto.create({
    data: { nombre, incluirPorDefecto, categoriaId: id }
  });
  res.json(concepto);
});

export default router;
