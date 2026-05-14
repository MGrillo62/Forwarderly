// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { calculateLineValues, calculateTotals } from '../utils/calculations';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { clienteId, lineas } = req.body;
  const { empresaId, id: vendedorId } = req.user!;

  try {
    if (!empresaId) return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });

    const calculatedLineas = lineas.map((linea: any) => ({
      ...linea,
      ...calculateLineValues(linea.costo, linea.precioVenta)
    }));

    const totals = calculateTotals(calculatedLineas);

    const cotizacion = await prisma.cotizacion.create({
      data: {
        clienteId,
        vendedorId,
        empresaId,
        ...totals,
        lineas: {
          create: calculatedLineas.map((l: any) => ({
            conceptoId: l.conceptoId,
            proveedorId: l.proveedorId,
            costo: l.costo,
            precioVenta: l.precioVenta,
            valorVenta: l.valorVenta,
            igv: l.igv,
            utilidad: l.utilidad,
            margen: l.margen
          }))
        }
      },
      include: { lineas: true, cliente: true }
    });

    res.json(cotizacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear cotización' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { clienteId, lineas, estado } = req.body;

  try {
    const existing = await prisma.cotizacion.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Cotización no encontrada' });

    if (existing.estado === 'APROBADA' || existing.estado === 'RECHAZADA') {
      return res.status(400).json({ message: 'No se puede modificar una cotización aprobada o rechazada' });
    }

    const calculatedLineas = lineas.map((linea: any) => ({
      ...linea,
      ...calculateLineValues(linea.costo, linea.precioVenta)
    }));

    const totals = calculateTotals(calculatedLineas);

    // Delete old lines and create new ones
    await prisma.cotizacionLinea.deleteMany({ where: { cotizacionId: id } });

    const updated = await prisma.cotizacion.update({
      where: { id },
      data: {
        clienteId,
        estado,
        ...totals,
        lineas: {
          create: calculatedLineas.map((l: any) => ({
            conceptoId: l.conceptoId,
            proveedorId: l.proveedorId,
            costo: l.costo,
            precioVenta: l.precioVenta,
            valorVenta: l.valorVenta,
            igv: l.igv,
            utilidad: l.utilidad,
            margen: l.margen
          }))
        }
      },
      include: { lineas: true }
    });

    // If approved, create Order
    if (estado === 'APROBADA') {
      const year = new Date().getFullYear();
      const lastOrden = await prisma.orden.findFirst({
        where: { anio: year },
        orderBy: { correlativo: 'desc' }
      });
      const correlativo = (lastOrden?.correlativo || 0) + 1;

      await prisma.orden.create({
        data: {
          cotizacionId: id,
          correlativo,
          anio: year,
          estado: 'COORDINACION_EMBARQUE'
        }
      });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar cotización' });
  }
});

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId, rol, id: vendedorId } = req.user!;
  const { search, estado, clienteId } = req.query;

  try {
    const where: any = { empresaId };
    if (rol === 'VENDEDOR') {
      where.vendedorId = vendedorId;
    }
    if (estado) where.estado = estado;
    if (clienteId) where.clienteId = clienteId;

    const cotizaciones = await prisma.cotizacion.findMany({
      where,
      include: { cliente: true, vendedor: true },
      orderBy: { createdAt: 'desc' }
    });

    res.json(cotizaciones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cotizaciones' });
  }
});

export default router;
