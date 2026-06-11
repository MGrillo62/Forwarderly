// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const origenes = await prisma.origen.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' }
    });
    res.json(origenes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const { nombre } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del origen es requerido.' });
    }

    // Buscar si ya existe para evitar duplicados
    const existente = await prisma.origen.findFirst({
      where: {
        nombre: { equals: nombre.trim(), mode: 'insensitive' },
        empresaId
      }
    });

    if (existente) {
      return res.json(existente);
    }

    const nuevoOrigen = await prisma.origen.create({
      data: {
        nombre: nombre.trim(),
        empresaId
      }
    });
    
    res.json(nuevoOrigen);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
