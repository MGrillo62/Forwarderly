import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all document types for the company
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { empresaId } = req.user!;
    if (!empresaId) {
      return res.status(400).json({ error: 'La empresa no está especificada en la sesión.' });
    }

    const tipos = await prisma.tipoDocumento.findMany({
      where: { empresaId },
      orderBy: { nombre: 'asc' }
    });
    
    res.json(tipos);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new document type
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { empresaId } = req.user!;
    const { nombre } = req.body;

    if (!empresaId) {
      return res.status(400).json({ error: 'La empresa no está especificada en la sesión.' });
    }
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del tipo de documento es requerido.' });
    }

    const nombreTrimmed = nombre.trim();

    // Check for duplicate names (case insensitive) within the same company
    const existente = await prisma.tipoDocumento.findFirst({
      where: {
        nombre: { equals: nombreTrimmed, mode: 'insensitive' },
        empresaId
      }
    });

    if (existente) {
      return res.status(400).json({ error: `El tipo de documento "${nombreTrimmed}" ya existe.` });
    }

    const nuevoTipo = await prisma.tipoDocumento.create({
      data: {
        nombre: nombreTrimmed,
        empresaId
      }
    });

    res.json(nuevoTipo);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a document type
router.put('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const empresaId = req.user!.empresaId as string;
    const { nombre } = req.body;

    if (!empresaId) {
      return res.status(400).json({ error: 'La empresa no está especificada en la sesión.' });
    }
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json({ error: 'El nombre del tipo de documento es requerido.' });
    }

    const nombreTrimmed = nombre.trim();

    // Check if the document type exists
    const existente = await prisma.tipoDocumento.findUnique({
      where: { id }
    });

    if (!existente || existente.empresaId !== empresaId) {
      return res.status(404).json({ error: 'Tipo de documento no encontrado.' });
    }

    // Check for duplicate names (excluding current ID)
    const duplicado = await prisma.tipoDocumento.findFirst({
      where: {
        id: { not: id },
        nombre: { equals: nombreTrimmed, mode: 'insensitive' },
        empresaId
      }
    });

    if (duplicado) {
      return res.status(400).json({ error: `Ya existe otro tipo de documento con el nombre "${nombreTrimmed}".` });
    }

    const actualizado = await prisma.tipoDocumento.update({
      where: { id },
      data: { nombre: nombreTrimmed }
    });

    res.json(actualizado);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a document type
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const empresaId = req.user!.empresaId as string;

    if (!empresaId) {
      return res.status(400).json({ error: 'La empresa no está especificada en la sesión.' });
    }

    const existente = await prisma.tipoDocumento.findUnique({
      where: { id }
    });

    if (!existente || existente.empresaId !== empresaId) {
      return res.status(404).json({ error: 'Tipo de documento no encontrado.' });
    }

    await prisma.tipoDocumento.delete({
      where: { id }
    });

    res.json({ message: 'Tipo de documento eliminado con éxito.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
