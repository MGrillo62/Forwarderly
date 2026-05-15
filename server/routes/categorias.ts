// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const categorias = await prisma.categoria.findMany({
      where: { empresaId },
      include: { conceptos: true }
    });
    res.json(categorias);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const { nombre, afectoIGV } = req.body;
    const categoria = await prisma.categoria.create({
      data: { nombre, afectoIGV: afectoIGV !== undefined ? afectoIGV : true, empresaId }
    });
    res.json(categoria);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, afectoIGV } = req.body;
    const categoria = await prisma.categoria.update({
      where: { id },
      data: { nombre, afectoIGV }
    });
    res.json(categoria);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/conceptos', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { nombre, incluirPorDefecto } = req.body;
    const concepto = await prisma.concepto.create({
      data: { nombre, incluirPorDefecto, categoriaId: id }
    });
    res.json(concepto);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
