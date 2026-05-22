import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Helper to get all months between two dates inclusive
function getMonthsRange(start: Date, end: Date) {
  const range = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const last = new Date(end.getFullYear(), end.getMonth(), 1);
  
  while (current <= last) {
    range.push({
      mes: current.getMonth() + 1,
      anio: current.getFullYear()
    });
    current.setMonth(current.getMonth() + 1);
  }
  return range;
}

// GET /api/suscripciones - Fetch and auto-generate subscriptions
router.get('/', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const { estadoPago, empresaId, mes, anio } = req.query;
    const today = new Date();

    // 1. Fetch all active companies to run self-healing generation
    const activeCompanies = await prisma.empresa.findMany({
      where: { estado: 'ACTIVO' }
    });

    for (const company of activeCompanies) {
      const start = new Date(company.fechaInicio);
      
      if (company.periodicidad === 'MENSUAL') {
        const months = getMonthsRange(start, today);
        for (const m of months) {
          // Check if this specific month/year subscription already exists
          const exists = await prisma.pagoSuscripcion.findUnique({
            where: {
              empresaId_mes_anio: {
                empresaId: company.id,
                mes: m.mes,
                anio: m.anio
              }
            }
          });

          if (!exists) {
            // Determine initial status based on due date
            const dueDate = new Date(m.anio, m.mes - 1, company.diaPagoSuscripcion, 23, 59, 59);
            const status = today > dueDate ? 'VENCIDO' : 'PENDIENTE';

            await prisma.pagoSuscripcion.create({
              data: {
                empresaId: company.id,
                mes: m.mes,
                anio: m.anio,
                monto: company.montoSuscripcion,
                estadoPago: status
              }
            });
          }
        }
      } else if (company.periodicidad === 'ANUAL') {
        const anniversaryMonth = start.getMonth() + 1;
        const startYear = start.getFullYear();
        const currentYear = today.getFullYear();

        for (let y = startYear; y <= currentYear; y++) {
          // Verify if we have reached the anniversary date in this year
          const anniversaryDate = new Date(y, anniversaryMonth - 1, company.diaPagoSuscripcion, 23, 59, 59);
          
          // If the anniversary date for this year is in the future, don't generate yet
          // unless it's the start year (which represents their initial signup billing)
          if (y > startYear && today < new Date(y, anniversaryMonth - 1, 1)) {
            continue;
          }

          const exists = await prisma.pagoSuscripcion.findUnique({
            where: {
              empresaId_mes_anio: {
                empresaId: company.id,
                mes: anniversaryMonth,
                anio: y
              }
            }
          });

          if (!exists) {
            const status = today > anniversaryDate ? 'VENCIDO' : 'PENDIENTE';
            await prisma.pagoSuscripcion.create({
              data: {
                empresaId: company.id,
                mes: anniversaryMonth,
                anio: y,
                monto: company.montoSuscripcion,
                estadoPago: status
              }
            });
          }
        }
      }
    }

    // 2. Perform self-healing transition from PENDIENTE to VENCIDO for overdue subscriptions
    const pendingSubs = await prisma.pagoSuscripcion.findMany({
      where: { estadoPago: 'PENDIENTE' },
      include: { empresa: true }
    });

    for (const sub of pendingSubs) {
      const dueDate = new Date(sub.anio, sub.mes - 1, sub.empresa.diaPagoSuscripcion, 23, 59, 59);
      if (today > dueDate) {
        await prisma.pagoSuscripcion.update({
          where: { id: sub.id },
          data: { estadoPago: 'VENCIDO' }
        });
      }
    }

    // 3. Build filter query and return results
    const whereClause: any = {};
    if (estadoPago) whereClause.estadoPago = estadoPago as string;
    if (empresaId) whereClause.empresaId = empresaId as string;
    if (mes) whereClause.mes = parseInt(mes as string);
    if (anio) whereClause.anio = parseInt(anio as string);

    const subscriptions = await prisma.pagoSuscripcion.findMany({
      where: whereClause,
      include: {
        empresa: true
      },
      orderBy: [
        { anio: 'desc' },
        { mes: 'desc' }
      ]
    });

    res.json(subscriptions);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener suscripciones: ' + error.message });
  }
});

// PUT /api/suscripciones/:id/pagar - Register subscription payment
router.put('/:id/pagar', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const { id } = req.params;
  const { modalidad, banco, referencia, fechaPago } = req.body;

  try {
    if (!modalidad) {
      return res.status(400).json({ message: 'La modalidad de pago es obligatoria' });
    }

    const updated = await prisma.pagoSuscripcion.update({
      where: { id: id as string },
      data: {
        estadoPago: 'PAGADO',
        modalidad,
        banco: banco || null,
        referencia: referencia || null,
        fechaPago: fechaPago ? new Date(fechaPago) : new Date()
      },
      include: {
        empresa: true
      }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al registrar pago de suscripción: ' + error.message });
  }
});

export default router;
