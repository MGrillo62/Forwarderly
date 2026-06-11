// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const destinos = await prisma.destino.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' }
    });
    res.json(destinos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const { nombre } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del destino es requerido.' });
    }

    // Buscar si ya existe para evitar duplicados
    const existente = await prisma.destino.findFirst({
      where: {
        nombre: { equals: nombre.trim(), mode: 'insensitive' },
        empresaId
      }
    });

    if (existente) {
      return res.json(existente);
    }

    const nuevoDestino = await prisma.destino.create({
      data: {
        nombre: nombre.trim(),
        empresaId
      }
    });
    
    res.json(nuevoDestino);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
