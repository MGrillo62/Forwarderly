// @ts-nocheck
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
        cobros: true,
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
    referencia, email, estado,
    proveedorExtranjero, nroFacturaComercial, tipoCarga, nroContenedor
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
        include: { 
          cotizacion: true, 
          pagos: true,
          cobros: true
        }
      });
      
      const totalPagadoSoles = 
        (orden?.pagos.reduce((acc, p) => acc + p.monto, 0) || 0) +
        (orden?.cobros.reduce((acc, c) => {
          if (c.moneda === 'PEN') return acc + c.monto;
          return acc + (c.monto * (c.tipoCambio || 1));
        }, 0) || 0);

      const totalOrdenSoles = orden?.cotizacion.precioTotal || 0;

      if (totalPagadoSoles < totalOrdenSoles - 0.01) {
        return res.status(400).json({ message: 'La orden debe estar totalmente cobrada/pagada para culminar el despacho' });
      }
    }

    const updated = await prisma.orden.update({
      where: { id },
      data: {
        nroBL, nroDAM, canal, 
        fechaETD: fechaETD ? new Date(fechaETD) : null,
        fechaETA: fechaETA ? new Date(fechaETA) : null,
        fechaRealEntrega: fechaRealEntrega ? new Date(fechaRealEntrega) : null,
        referencia, email, estado,
        proveedorExtranjero, nroFacturaComercial, tipoCarga, nroContenedor
      }
    });

    // Sync to linked CosteoImportacion if any using safe raw SQL
    await prisma.$executeRawUnsafe(`
      UPDATE "CosteoImportacion" SET
        "proveedorExtranjero" = $1,
        "nroFacturaComercial" = $2,
        "tipoCarga" = $3,
        "nroContenedor" = $4,
        "nroDAM" = $5,
        "canal" = cast($6 as "CanalImportacion"),
        "fechaEmbarque" = cast($7 as timestamp),
        "fechaLlegada" = cast($8 as timestamp)
      WHERE "ordenId" = $9`,
      proveedorExtranjero || null,
      nroFacturaComercial || null,
      tipoCarga || null,
      nroContenedor || null,
      nroDAM || null,
      canal || null,
      fechaETD ? new Date(fechaETD) : null,
      fechaETA ? new Date(fechaETA) : null,
      id
    );

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

// Get all cobros for an order
router.get('/:id/cobros', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const cobros = await prisma.cobro.findMany({
      where: { ordenId: id },
      orderBy: { createdAt: 'desc' }
    });
    res.json(cobros);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener cobros: ' + error.message });
  }
});

// Register a new cobro for an order
router.post('/:id/cobros', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { moneda, monto, metodo, tipoDocumento, nroDocumento, fechaDocumento, lineasIds, tipoCambio } = req.body;

  try {
    if (!moneda || !monto || !metodo) {
      return res.status(400).json({ message: 'Datos requeridos faltantes (moneda, monto, metodo)' });
    }

    const cobro = await prisma.cobro.create({
      data: {
        ordenId: id,
        moneda,
        monto: parseFloat(monto),
        metodo,
        tipoDocumento: tipoDocumento || null,
        nroDocumento: nroDocumento || null,
        fechaDocumento: fechaDocumento ? new Date(fechaDocumento) : null,
        lineasIds: Array.isArray(lineasIds) ? lineasIds : [],
        tipoCambio: tipoCambio ? parseFloat(tipoCambio) : 1
      }
    });

    res.json(cobro);
  } catch (error: any) {
    console.error('Error al registrar cobro:', error);
    res.status(500).json({ message: 'Error al registrar cobro: ' + error.message });
  }
});

// Delete a cobro
router.delete('/cobros/:cobroId', authenticate, async (req: AuthRequest, res) => {
  const { cobroId } = req.params;
  try {
    await prisma.cobro.delete({
      where: { id: cobroId }
    });
    res.json({ message: 'Cobro eliminado con éxito' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar cobro: ' + error.message });
  }
});

export default router;
