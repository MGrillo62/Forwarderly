import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all leads for the current empresa
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const leads = await prisma.lead.findMany({ 
      where: { empresaId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single lead
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const lead = await prisma.lead.findFirst({
      where: { id, empresaId: req.user!.empresaId }
    });
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new lead
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const { nombre, ruc, razonSocial, direccion, contacto, correo, celular, estado } = req.body;
    
    if (!contacto) {
      return res.status(400).json({ error: 'El nombre de contacto es obligatorio' });
    }

    const lead = await prisma.lead.create({
      data: {
        nombre,
        ruc,
        razonSocial,
        direccion,
        contacto,
        correo,
        celular,
        estado: estado || 'NUEVO_CONTACTO',
        empresaId
      }
    });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update a lead
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { nombre, ruc, razonSocial, direccion, contacto, correo, celular, estado } = req.body;
    
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        nombre,
        ruc,
        razonSocial,
        direccion,
        contacto,
        correo,
        celular,
        estado
      }
    });
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a lead
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    await prisma.lead.delete({
      where: { id }
    });
    res.json({ message: 'Lead eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
