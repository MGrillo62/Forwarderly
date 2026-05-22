// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all orders
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId, rol, id: vendedorId } = req.user!;
  const { clienteId, estado, nroBL, canal } = req.query;

  try {
    const andFilters: any[] = [
      {
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      }
    ];

    if (rol === 'VENDEDOR') {
      andFilters.push({
        OR: [
          { cotizacion: { vendedorId } },
          { cotizacionesAsociadas: { some: { vendedorId } } }
        ]
      });
    }

    if (clienteId) {
      andFilters.push({
        OR: [
          { cotizacion: { clienteId } },
          { cotizacionesAsociadas: { some: { clienteId } } }
        ]
      });
    }

    if (estado) {
      andFilters.push({ estado });
    }

    if (nroBL) {
      andFilters.push({ nroBL: { contains: nroBL as string, mode: 'insensitive' } });
    }

    if (canal) {
      andFilters.push({ canal });
    }

    const where: any = { AND: andFilters };

    const ordenes = await prisma.orden.findMany({
      where,
      include: {
        cotizacion: {
          include: { cliente: true, vendedor: true, lineas: { include: { concepto: true } } }
        },
        cotizacionesAsociadas: {
          include: { cliente: true, vendedor: true, lineas: { include: { concepto: true } } }
        },
        pagos: true,
        cobros: true,
        costeo: true,
        historial: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(ordenes);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener órdenes' });
  }
});

// Create a merged order from multiple quotes
router.post('/multiple', authenticate, async (req: AuthRequest, res) => {
  const { cotizacionIds, referencia, email } = req.body;
  const { empresaId } = req.user!;

  try {
    if (!cotizacionIds || !Array.isArray(cotizacionIds) || cotizacionIds.length === 0) {
      return res.status(400).json({ message: 'Debe seleccionar al menos una cotización' });
    }

    // Verify all quotes exist, are APROBADA, belong to the company, and are not already linked to an order
    const quotes = await prisma.cotizacion.findMany({
      where: {
        id: { in: cotizacionIds },
        empresaId,
        estado: 'APROBADA'
      },
      include: {
        orden: true,
        ordenAsociada: true
      }
    });

    if (quotes.length !== cotizacionIds.length) {
      return res.status(400).json({ message: 'Algunas cotizaciones seleccionadas no son válidas, no están aprobadas, o pertenecen a otra empresa.' });
    }

    // Check if any is already linked to an order
    const alreadyLinked = quotes.find(q => q.orden || q.ordenId || q.ordenAsociada);
    if (alreadyLinked) {
      return res.status(400).json({ message: `La cotización N° ${alreadyLinked.numero} ya está asociada a otra orden.` });
    }

    const year = new Date().getFullYear();
    const lastOrden = await prisma.orden.findFirst({
      where: { anio: year },
      orderBy: { correlativo: 'desc' }
    });
    const correlativo = (lastOrden?.correlativo || 0) + 1;

    // Create the merged order
    const newOrden = await prisma.orden.create({
      data: {
        correlativo,
        anio: year,
        estado: 'COORDINACION_EMBARQUE',
        referencia: referencia || null,
        email: email || null,
        cotizacionesAsociadas: {
          connect: cotizacionIds.map(id => ({ id }))
        }
      },
      include: {
        cotizacionesAsociadas: {
          include: { cliente: true, vendedor: true, lineas: true }
        },
        historial: true
      }
    });

    // Add state change history
    await prisma.ordenEstadoHistorial.create({
      data: {
        ordenId: newOrden.id,
        estado: 'COORDINACION_EMBARQUE'
      }
    });

    res.json(newOrden);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear la orden múltiple: ' + error.message });
  }
});

// Update order
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
          cotizacionesAsociadas: true,
          pagos: true,
          cobros: true
        }
      });
      
      let totalOrdenSoles = 0;
      const usdRate = 3.75;
      const eurRate = 4.10;

      if (orden?.cotizacion) {
        const rate = orden.cotizacion.moneda === 'USD' ? usdRate : orden.cotizacion.moneda === 'EUR' ? eurRate : 1;
        totalOrdenSoles = orden.cotizacion.precioTotal * rate;
      }
      if (orden?.cotizacionesAsociadas && orden.cotizacionesAsociadas.length > 0) {
        for (const c of orden.cotizacionesAsociadas) {
          const rate = c.moneda === 'USD' ? usdRate : c.moneda === 'EUR' ? eurRate : 1;
          totalOrdenSoles += c.precioTotal * rate;
        }
      }

      const totalPagadoSoles = 
        (orden?.pagos.reduce((acc, p) => acc + p.monto, 0) || 0) +
        (orden?.cobros.reduce((acc, c) => {
          if (c.moneda === 'PEN') return acc + c.monto;
          return acc + (c.monto * (c.tipoCambio || 1));
        }, 0) || 0);

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
    console.error(error);
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
  const { moneda, monto, metodo, tipoDocumento, nroDocumento, fechaDocumento, lineasIds, tipoCambio, referencia, detallesLineas, banco } = req.body;

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
        referencia: referencia || null,
        detallesLineas: detallesLineas ? (typeof detallesLineas === 'string' ? detallesLineas : JSON.stringify(detallesLineas)) : null,
        tipoCambio: tipoCambio ? parseFloat(tipoCambio) : 1,
        banco: banco || null
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
