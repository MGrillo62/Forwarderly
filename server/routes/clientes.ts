import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const clientes = await prisma.cliente.findMany({ 
      where: { empresaId },
      orderBy: { razonSocial: 'asc' }
    });
    res.json(clientes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    const { ruc, razonSocial, direccion, direccionEntrega, contacto, correo, celular, giroNegocio, contactos } = req.body;
    
    if (!ruc || !razonSocial || !contacto) {
      return res.status(400).json({ error: 'RUC, Razón Social y Contacto son campos obligatorios.' });
    }

    const cliente = await prisma.cliente.create({
      data: {
        ruc,
        razonSocial,
        direccion,
        direccionEntrega,
        contacto,
        correo,
        celular,
        giroNegocio,
        contactos,
        empresaId
      }
    });
    res.json(cliente);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { ruc, razonSocial, direccion, direccionEntrega, contacto, correo, celular, giroNegocio, contactos } = req.body;
    
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        ruc,
        razonSocial,
        direccion,
        direccionEntrega,
        contacto,
        correo,
        celular,
        giroNegocio,
        contactos
      }
    });
    res.json(cliente);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    await prisma.cliente.delete({
      where: { id }
    });
    res.json({ message: 'Cliente eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
