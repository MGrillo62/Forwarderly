// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { calculateLineValues, calculateTotals } from '../utils/calculations';

const router = Router();
const prisma = new PrismaClient();

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { clienteId, leadId, lineas, moneda } = req.body;
  const { empresaId, id: vendedorId } = req.user!;

  try {
    if (!empresaId) return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });

    const calculatedLineas = lineas.map((linea: any) => ({
      ...linea,
      ...calculateLineValues(linea.costo, linea.precioVenta, linea.afectoIGV)
    }));

    const totals = calculateTotals(calculatedLineas);

    const cotizacion = await prisma.cotizacion.create({
      data: {
        clienteId: clienteId || null,
        leadId: leadId || null,
        moneda: moneda || 'USD',
        vendedorId,
        empresaId,
        ...totals,
        lineas: {
          create: calculatedLineas.map((l: any) => ({
            conceptoId: l.conceptoId,
            proveedorId: l.proveedorId && l.proveedorId !== '' ? l.proveedorId : null,
            costo: l.costo,
            precioVenta: l.precioVenta,
            valorVenta: l.valorVenta,
            igv: l.igv,
            utilidad: l.utilidad,
            margen: l.margen
          }))
        },
        historial: {
          create: {
            estado: 'BORRADOR',
            usuarioId: vendedorId
          }
        }
      },
      include: { lineas: true, cliente: true, lead: true, historial: true }
    });

    res.json(cotizacion);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear cotización' });
  }
});

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { clienteId, leadId, lineas, estado, clientConversion, moneda } = req.body;
  const { empresaId } = req.user!;

  try {
    const existing = await prisma.cotizacion.findUnique({ 
      where: { id },
      include: { lead: true }
    });
    if (!existing) return res.status(404).json({ message: 'Cotización no encontrada' });

    if (existing.estado === 'APROBADA' || existing.estado === 'RECHAZADA') {
      return res.status(400).json({ message: 'No se puede modificar una cotización aprobada o rechazada' });
    }

    let finalClienteId = clienteId || existing.clienteId;
    let finalLeadId = leadId !== undefined ? leadId : existing.leadId;

    // Lógica de Conversión de Lead a Cliente si el estado cambia a APROBADA y está vinculada a un Lead
    if (estado === 'APROBADA' && (finalLeadId || existing.leadId)) {
      const activeLeadId = finalLeadId || existing.leadId;
      if (clientConversion) {
        const { ruc, razonSocial, direccion, contacto, correo, celular } = clientConversion;
        if (!ruc || !razonSocial || !direccion || !contacto) {
          return res.status(400).json({ message: 'Datos obligatorios del cliente faltantes (RUC, Razón Social, Dirección, Contacto).' });
        }

        // Crear el Cliente
        const newCliente = await prisma.cliente.create({
          data: {
            ruc,
            razonSocial,
            direccion,
            contacto,
            correo: correo || null,
            celular: celular || null,
            empresaId
          }
        });

        finalClienteId = newCliente.id;
        
        // Actualizar el Lead a CERRADO_GANADO
        await prisma.lead.update({
          where: { id: activeLeadId },
          data: { estado: 'CERRADO_GANADO' }
        });
      } else {
        if (!finalClienteId) {
          return res.status(400).json({ message: 'Se requiere la conversión del Lead a Cliente para aprobar la cotización.' });
        }
      }
    } else if (estado === 'RECHAZADA' && (finalLeadId || existing.leadId)) {
      const activeLeadId = finalLeadId || existing.leadId;
      await prisma.lead.update({
        where: { id: activeLeadId },
        data: { estado: 'CERRADO_PERDIDO' }
      });
    }

    let updated;
    if (lineas) {
      const calculatedLineas = lineas.map((linea: any) => ({
        ...linea,
        ...calculateLineValues(linea.costo, linea.precioVenta, linea.afectoIGV)
      }));

      const totals = calculateTotals(calculatedLineas);

      await prisma.cotizacionLinea.deleteMany({ where: { cotizacionId: id } });

      updated = await prisma.cotizacion.update({
        where: { id },
        data: {
          clienteId: finalClienteId,
          leadId: finalLeadId,
          estado,
          moneda,
          ...totals,
          lineas: {
            create: calculatedLineas.map((l: any) => ({
              conceptoId: l.conceptoId,
              proveedorId: l.proveedorId && l.proveedorId !== '' ? l.proveedorId : null,
              costo: l.costo,
              precioVenta: l.precioVenta,
              valorVenta: l.valorVenta,
              igv: l.igv,
              utilidad: l.utilidad,
              margen: l.margen
            }))
          },
          ...(estado && estado !== existing.estado && {
            historial: {
              create: {
                estado: estado,
                usuarioId: req.user!.id
              }
            }
          })
        },
        include: { lineas: true, lead: true, cliente: true, historial: { include: { usuario: true } } }
      });
    } else {
      updated = await prisma.cotizacion.update({
        where: { id },
        data: {
          clienteId: finalClienteId,
          leadId: finalLeadId,
          estado,
          moneda,
          ...(estado !== existing.estado && {
            historial: {
              create: {
                estado: estado,
                usuarioId: req.user!.id
              }
            }
          })
        },
        include: { lineas: true, lead: true, cliente: true, historial: { include: { usuario: true } } }
      });
    }

    if (estado === 'APROBADA' && req.body.crearOrdenImmediately === true) {
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
    console.error(error);
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
      include: { 
        cliente: true, 
        lead: true,
        vendedor: true, 
        orden: true,
        historial: { 
          include: { usuario: true },
          orderBy: { fechaHora: 'asc' }
        },
        lineas: {
          include: {
            concepto: {
              include: { categoria: true }
            },
            proveedor: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(cotizaciones);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener cotizaciones' });
  }
});

// Duplicar cotización
router.post('/:id/duplicar', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { clienteId, leadId } = req.body;
  const { empresaId, id: vendedorId } = req.user!;

  try {
    const existing = await prisma.cotizacion.findUnique({
      where: { id },
      include: { lineas: true }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Cotización no encontrada' });
    }

    const targetClienteId = clienteId !== undefined ? clienteId : existing.clienteId;
    const targetLeadId = leadId !== undefined ? leadId : existing.leadId;

    const duplicated = await prisma.cotizacion.create({
      data: {
        clienteId: targetClienteId,
        leadId: targetLeadId,
        vendedorId,
        empresaId,
        moneda: existing.moneda,
        pais: existing.pais,
        estado: 'BORRADOR',
        totalVenta: existing.totalVenta,
        igv: existing.igv,
        precioTotal: existing.precioTotal,
        utilidad: existing.utilidad,
        porcentajeUtilidad: existing.porcentajeUtilidad,
        lineas: {
          create: existing.lineas.map((l) => ({
            conceptoId: l.conceptoId,
            proveedorId: l.proveedorId,
            costo: l.costo,
            precioVenta: l.precioVenta,
            valorVenta: l.valorVenta,
            igv: l.igv,
            utilidad: l.utilidad,
            margen: l.margen
          }))
        },
        historial: {
          create: {
            estado: 'BORRADOR',
            usuarioId: vendedorId
          }
        }
      },
      include: { lineas: true, cliente: true, lead: true, historial: true }
    });

    res.json(duplicated);
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: 'Error al duplicar cotización: ' + error.message });
  }
});

export default router;
