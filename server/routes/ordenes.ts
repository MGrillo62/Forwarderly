import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId, rol, id: vendedorId } = req.user!;
  const { clienteId, estado, nroBL, canal } = req.query;

  try {
    const where: any = {
      cotizacion: {
        empresaId
      }
    };

    if (rol === 'VENDEDOR') {
      where.cotizacion.vendedorId = vendedorId;
    }

    if (clienteId) where.cotizacion.clienteId = clienteId;
    if (estado) where.estado = estado;
    if (nroBL) where.nroBL = { contains: nroBL as string, mode: 'insensitive' };
    if (canal) where.canal = canal;

    const ordenes = await prisma.orden.findMany({
      where,
      include: {
        cotizacion: {
          include: { cliente: true, vendedor: true, lineas: { include: { concepto: true } } }
        },
        pagos: true,
        historial: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(ordenes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener órdenes' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { 
    nroBL, nroDAM, canal, fechaETD, fechaETA, fechaRealEntrega, 
    referencia, email, estado 
  } = req.body;

  try {
    const existing = await prisma.orden.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Orden no encontrada' });

    if (existing.estado === 'DESPACHO_CULMINADO') {
      return res.status(400).json({ message: 'No se puede modificar una orden culminada' });
    }

    // Check if total paid for DESPACHO_CULMINADO
    if (estado === 'DESPACHO_CULMINADO') {
      const orden = await prisma.orden.findUnique({
        where: { id },
        include: { cotizacion: true, pagos: true }
      });
      const totalPagado = orden?.pagos.reduce((acc, p) => acc + p.monto, 0) || 0;
      const totalOrden = orden?.cotizacion.precioTotal || 0;

      if (totalPagado < totalOrden) {
        return res.status(400).json({ message: 'La orden debe estar totalmente pagada para culminar el despacho' });
      }
    }

    const updated = await prisma.orden.update({
      where: { id },
      data: {
        nroBL, nroDAM, canal, 
        fechaETD: fechaETD ? new Date(fechaETD) : null,
        fechaETA: fechaETA ? new Date(fechaETA) : null,
        fechaRealEntrega: fechaRealEntrega ? new Date(fechaRealEntrega) : null,
        referencia, email, estado
      }
    });

    if (estado && estado !== existing.estado) {
      await prisma.ordenEstadoHistorial.create({
        data: { ordenId: id, estado }
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar orden' });
  }
});

router.post('/:id/pagos', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { monto, modo, fecha } = req.body;

  try {
    const pago = await prisma.ordenPago.create({
      data: {
        ordenId: id,
        monto,
        modo,
        fecha: fecha ? new Date(fecha) : new Date()
      }
    });

    res.json(pago);
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar pago' });
  }
});

export default router;
