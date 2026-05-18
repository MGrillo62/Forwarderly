import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Dashboard Comercial
router.get('/comercial', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    
    // 1. Leads nuevos en el mes actual
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const leadsNuevosMes = await prisma.lead.count({
      where: {
        empresaId,
        createdAt: { gte: startOfMonth }
      }
    });

    const totalLeads = await prisma.lead.count({
      where: { empresaId }
    });

    // Breakdown of Leads by state
    const leadsPorEstado = await prisma.lead.groupBy({
      by: ['estado'],
      where: { empresaId },
      _count: true
    });

    // 2. Tasa de conversión
    const cotizacionesEnviadas = await prisma.cotizacion.count({
      where: { empresaId, estado: 'ENVIADA' }
    });
    const cotizacionesAprobadas = await prisma.cotizacion.count({
      where: { empresaId, estado: 'APROBADA' }
    });
    const cotizacionesRechazadas = await prisma.cotizacion.count({
      where: { empresaId, estado: 'RECHAZADA' }
    });
    const cotizacionesBorrador = await prisma.cotizacion.count({
      where: { empresaId, estado: 'BORRADOR' }
    });

    const totalCotizacionesActivas = cotizacionesEnviadas + cotizacionesAprobadas + cotizacionesRechazadas;
    const tasaConversion = totalCotizacionesActivas > 0 
      ? (cotizacionesAprobadas / totalCotizacionesActivas) * 100 
      : 0;

    // 3. Rendimiento por vendedor
    const usuarios = await prisma.usuario.findMany({
      where: { empresaId, rol: 'VENDEDOR' },
      select: {
        id: true,
        nombres: true,
        apellidos: true,
        username: true,
        cotizaciones: {
          select: {
            estado: true,
            precioTotal: true,
            utilidad: true
          }
        }
      }
    });

    const rendimientoVendedores = usuarios.map(u => {
      const total = u.cotizaciones.length;
      const aprobadas = u.cotizaciones.filter(c => c.estado === 'APROBADA').length;
      const totalVendido = u.cotizaciones.filter(c => c.estado === 'APROBADA').reduce((sum, c) => sum + c.precioTotal, 0);
      const utilidadTotal = u.cotizaciones.filter(c => c.estado === 'APROBADA').reduce((sum, c) => sum + c.utilidad, 0);
      return {
        vendedorId: u.id,
        nombre: `${u.nombres} ${u.apellidos}`,
        username: u.username,
        totalCotizaciones: total,
        cotizacionesAprobadas: aprobadas,
        totalVendido,
        utilidadTotal,
        tasaConversion: total > 0 ? (aprobadas / total) * 100 : 0
      };
    });

    res.json({
      leadsNuevosMes,
      totalLeads,
      leadsPorEstado,
      tasaConversion: parseFloat(tasaConversion.toFixed(2)),
      cotizacionesStats: {
        borrador: cotizacionesBorrador,
        enviada: cotizacionesEnviadas,
        aprobada: cotizacionesAprobadas,
        rechazada: cotizacionesRechazadas,
        total: cotizacionesBorrador + totalCotizacionesActivas
      },
      rendimientoVendedores
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Operativo
router.get('/operativo', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;

    // 1. Órdenes en curso
    const ordenesEnCurso = await prisma.orden.count({
      where: {
        cotizacion: { empresaId },
        estado: { not: 'DESPACHO_CULMINADO' }
      }
    });

    const ordenesTerminadas = await prisma.orden.count({
      where: {
        cotizacion: { empresaId },
        estado: 'DESPACHO_CULMINADO'
      }
    });

    const activeOrdersList = await prisma.orden.findMany({
      where: {
        cotizacion: { empresaId },
        estado: { not: 'DESPACHO_CULMINADO' }
      },
      include: {
        cotizacion: {
          include: {
            cliente: true,
            lead: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Group active orders by state
    const ordenesPorEstado = await prisma.orden.groupBy({
      by: ['estado'],
      where: {
        cotizacion: {
          empresaId
        }
      },
      _count: true
    });

    // 2. Costeos
    const costeosBorrador = await prisma.costeoImportacion.count({
      where: { empresaId, estado: 'BORRADOR' }
    });
    const costeosTerminado = await prisma.costeoImportacion.count({
      where: { empresaId, estado: 'TERMINADO' }
    });

    // Recent costings
    const recentCosteos = await prisma.costeoImportacion.findMany({
      where: { empresaId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        cliente: true
      }
    });

    // 3. Utilidades y Ventas
    const utilidadesSum = await prisma.cotizacion.aggregate({
      where: { empresaId, estado: 'APROBADA' },
      _sum: {
        utilidad: true,
        precioTotal: true
      }
    });

    const totalUtilidad = utilidadesSum._sum.utilidad || 0;
    const totalVendido = utilidadesSum._sum.precioTotal || 0;

    res.json({
      ordenes: {
        enCurso: ordenesEnCurso,
        terminadas: ordenesTerminadas,
        porEstado: ordenesPorEstado,
        listadoActivas: activeOrdersList
      },
      costeos: {
        borrador: costeosBorrador,
        terminado: costeosTerminado,
        total: costeosBorrador + costeosTerminado,
        listadoRecientes: recentCosteos
      },
      financiero: {
        totalUtilidad,
        totalVendido,
        margenPromedio: totalVendido > 0 ? parseFloat(((totalUtilidad / totalVendido) * 100).toFixed(2)) : 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
