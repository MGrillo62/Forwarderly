// server/routes/reclamaciones.ts
import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';
import { sendClaimEmail } from '../utils/email';

const router = Router();
const prisma = new PrismaClient();

// POST /api/reclamaciones - Public route to file a new claim/complaint
router.post('/', async (req, res: Response) => {
  try {
    const {
      nombres,
      apellidos,
      tipoDocumento,
      nroDocumento,
      domicilio,
      telefono,
      correo,
      representante,
      tipoBien,
      montoReclamado,
      descripcionBien,
      tipoReclamacion,
      detalle,
      pedido
    } = req.body;

    // Simple validations
    if (!nombres || !apellidos || !tipoDocumento || !nroDocumento || !correo || !detalle || !pedido) {
      return res.status(400).json({ message: 'Todos los campos obligatorios deben ser completados.' });
    }

    const currentYear = new Date().getFullYear();

    // Transaction to ensure sequential correlativo is safe
    const newClaim = await prisma.$transaction(async (tx) => {
      // Find the last correlativo for the current year
      const lastClaim = await tx.reclamacion.findFirst({
        where: { anio: currentYear },
        orderBy: { correlativo: 'desc' }
      });

      const nextCorrelativo = lastClaim ? lastClaim.correlativo + 1 : 1;
      const formattedNumber = `RECLAMO-${currentYear}-${String(nextCorrelativo).padStart(4, '0')}`;

      return tx.reclamacion.create({
        data: {
          correlativo: nextCorrelativo,
          anio: currentYear,
          numeroReclamacion: formattedNumber,
          nombres,
          apellidos,
          tipoDocumento,
          nroDocumento,
          domicilio: domicilio || 'No especificado',
          telefono: telefono || 'No especificado',
          correo,
          representante: representante || null,
          tipoBien: tipoBien || 'SERVICIO',
          montoReclamado: montoReclamado ? parseFloat(montoReclamado) : 0,
          descripcionBien: descripcionBien || 'No especificada',
          tipoReclamacion: tipoReclamacion || 'RECLAMO',
          detalle,
          pedido,
          estado: 'PENDIENTE'
        }
      });
    });

    // Send email notifications asynchronously
    sendClaimEmail(newClaim).catch(err => {
      console.error('[EMAIL ERROR] Error al disparar correo de reclamación:', err.message);
    });

    res.json(newClaim);
  } catch (error: any) {
    console.error('Error creating claim:', error);
    res.status(500).json({ message: 'Error interno del servidor al procesar la reclamación.' });
  }
});

// GET /api/reclamaciones - Authenticated route (SUPER_ADMIN and ADMIN only) to fetch claims
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const claims = await prisma.reclamacion.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(claims);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener las reclamaciones: ' + error.message });
  }
});

// PUT /api/reclamaciones/:id - Authenticated route (SUPER_ADMIN and ADMIN only) to answer a claim
router.put('/:id', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const { respuesta, estado } = req.body;

    if (!respuesta || respuesta.trim() === '') {
      return res.status(400).json({ message: 'La respuesta es requerida para actualizar el estado del reclamo.' });
    }

    const claim = await prisma.reclamacion.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ message: 'Reclamación no encontrada.' });
    }

    const updatedClaim = await prisma.reclamacion.update({
      where: { id },
      data: {
        respuesta,
        estado: estado || 'ATENDIDO',
        fechaRespuesta: new Date()
      }
    });

    res.json(updatedClaim);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al actualizar la reclamación: ' + error.message });
  }
});

// DELETE /api/reclamaciones/:id - Authenticated route (SUPER_ADMIN only) to delete a claim
router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), async (req: AuthRequest, res) => {
  try {
    const id = req.params.id as string;
    const claim = await prisma.reclamacion.findUnique({ where: { id } });
    if (!claim) {
      return res.status(404).json({ message: 'Reclamación no encontrada.' });
    }
    await prisma.reclamacion.delete({ where: { id } });
    res.json({ success: true, message: 'Reclamación eliminada con éxito.' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar la reclamación: ' + error.message });
  }
});

export default router;
