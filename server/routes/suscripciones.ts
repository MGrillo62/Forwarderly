import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';
import Stripe from 'stripe';

const router = Router();
const prisma = new PrismaClient();

// Initialize Stripe (will fail gracefully if key is not configured)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
  apiVersion: '2023-10-16' as any,
});

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
router.get('/', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const userRol = req.user?.rol;
    const userEmpresaId = req.user?.empresaId;
    const { estadoPago, empresaId, mes, anio } = req.query;
    const today = new Date();

    // Determine target company filter
    let filterEmpresaId = empresaId as string;
    if (userRol !== 'SUPER_ADMIN') {
      if (!userEmpresaId) {
        return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });
      }
      filterEmpresaId = userEmpresaId;
    }

    // 1. Fetch active companies to run self-healing generation
    const companyWhereClause: any = { estado: 'ACTIVO' };
    if (filterEmpresaId) {
      companyWhereClause.id = filterEmpresaId;
    }

    const activeCompanies = await prisma.empresa.findMany({
      where: companyWhereClause
    });

    for (const company of activeCompanies) {
      // Calculate effective start date based on trial days
      const start = new Date(company.fechaInicio);
      const effectiveStart = new Date(start);
      effectiveStart.setDate(effectiveStart.getDate() + (company.diasPrueba ?? 14));

      // If they are still in the trial period, do not generate billing periods yet
      if (today < effectiveStart) {
        continue;
      }

      if (company.periodicidad === 'MENSUAL') {
        const months = getMonthsRange(effectiveStart, today);
        for (const m of months) {
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
        const anniversaryMonth = effectiveStart.getMonth() + 1;
        const startYear = effectiveStart.getFullYear();
        const currentYear = today.getFullYear();

        for (let y = startYear; y <= currentYear; y++) {
          const anniversaryDate = new Date(y, anniversaryMonth - 1, company.diaPagoSuscripcion, 23, 59, 59);
          
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
    const pendingSubsWhereClause: any = { estadoPago: 'PENDIENTE' };
    if (filterEmpresaId) {
      pendingSubsWhereClause.empresaId = filterEmpresaId;
    }

    const pendingSubs = await prisma.pagoSuscripcion.findMany({
      where: pendingSubsWhereClause,
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
    if (filterEmpresaId) {
      whereClause.empresaId = filterEmpresaId;
    } else if (empresaId) {
      whereClause.empresaId = empresaId as string;
    }
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

// GET /api/suscripciones/estado-actual - Access control verification endpoint
router.get('/estado-actual', authenticate, async (req: AuthRequest, res) => {
  try {
    const userRol = req.user?.rol;
    const userEmpresaId = req.user?.empresaId;
    
    if (userRol === 'SUPER_ADMIN') {
      return res.json({ tieneAcceso: true, motivo: 'SUPER_ADMIN', diasRestantesTrial: 0 });
    }

    if (!userEmpresaId) {
      return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: userEmpresaId }
    });

    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    if (empresa.estado !== 'ACTIVO') {
      return res.json({ tieneAcceso: false, motivo: empresa.estado, diasRestantesTrial: 0 });
    }

    const today = new Date();
    const trialEnd = new Date(empresa.fechaInicio);
    trialEnd.setDate(trialEnd.getDate() + (empresa.diasPrueba ?? 14));

    const msRestantes = trialEnd.getTime() - today.getTime();
    const diasRestantesTrial = Math.ceil(msRestantes / (1000 * 60 * 60 * 24));
    const isTrialActive = today < trialEnd;

    // Check if there are VENCIDO subscriptions
    const subVencida = await prisma.pagoSuscripcion.findFirst({
      where: {
        empresaId: userEmpresaId,
        estadoPago: 'VENCIDO'
      }
    });

    if (subVencida) {
      return res.json({ 
        tieneAcceso: false, 
        motivo: 'SUSCRIPCION_VENCIDA', 
        diasRestantesTrial: 0,
        fechaFinPrueba: trialEnd
      });
    }

    // Check if they have ever paid
    const totalPagadas = await prisma.pagoSuscripcion.count({
      where: {
        empresaId: userEmpresaId,
        estadoPago: 'PAGADO'
      }
    });

    // If trial is over and they have never paid, they must pay the first subscription
    if (totalPagadas === 0 && !isTrialActive) {
      return res.json({ 
        tieneAcceso: false, 
        motivo: 'REQUIERE_PRIMER_PAGO', 
        diasRestantesTrial: 0,
        fechaFinPrueba: trialEnd
      });
    }

    return res.json({ 
      tieneAcceso: true, 
      motivo: isTrialActive ? 'TRIAL_ACTIVO' : 'AL_DIA', 
      diasRestantesTrial: isTrialActive ? Math.max(0, diasRestantesTrial) : 0,
      fechaFinPrueba: trialEnd,
      totalPagadas
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al verificar acceso: ' + error.message });
  }
});

// POST /api/suscripciones/:id/stripe-checkout - Create Stripe Checkout Session
router.post('/:id/stripe-checkout', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const userRol = req.user?.rol;
  const userEmpresaId = req.user?.empresaId;

  try {
    const sub = await prisma.pagoSuscripcion.findUnique({
      where: { id: id as string },
      include: { empresa: true }
    }) as any;

    if (!sub) {
      return res.status(404).json({ message: 'Cobro de suscripción no encontrado' });
    }

    // Security check: normal user can only pay their own company's subscription
    if (userRol !== 'SUPER_ADMIN' && sub.empresaId !== userEmpresaId) {
      return res.status(403).json({ message: 'No tienes permiso para pagar esta suscripción' });
    }

    if (sub.estadoPago === 'PAGADO') {
      return res.status(400).json({ message: 'Esta suscripción ya se encuentra pagada' });
    }

    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const mesNombre = months[sub.mes - 1] || '';

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'pen',
            product_data: {
              name: `Suscripción Forwarderly - ${mesNombre} ${sub.anio}`,
              description: `Facturación para ${sub.empresa.razonSocial} (${sub.empresa.periodicidad})`,
            },
            unit_amount: Math.round(sub.monto * 100), // in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${clientUrl}/suscripciones?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${clientUrl}/suscripciones?cancel=true`,
      metadata: {
        pagoSuscripcionId: sub.id,
        empresaId: sub.empresaId
      }
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating Stripe session:', error);
    res.status(500).json({ message: 'Error al iniciar pago con Stripe: ' + error.message });
  }
});

// POST /api/suscripciones/stripe-confirm - Confirm checkout payment directly
router.post('/stripe-confirm', authenticate, async (req: AuthRequest, res) => {
  const { sessionId } = req.body;
  const userRol = req.user?.rol;
  const userEmpresaId = req.user?.empresaId;

  try {
    if (!sessionId) {
      return res.status(400).json({ message: 'Session ID es requerido' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId) as any;
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ message: 'El pago no ha sido completado en Stripe' });
    }

    const subId = session.metadata?.pagoSuscripcionId;

    if (!subId) {
      return res.status(400).json({ message: 'ID de suscripción ausente en los metadatos' });
    }

    const sub = await prisma.pagoSuscripcion.findUnique({
      where: { id: subId }
    });

    if (!sub) {
      return res.status(404).json({ message: 'Suscripción no encontrada' });
    }

    if (userRol !== 'SUPER_ADMIN' && sub.empresaId !== userEmpresaId) {
      return res.status(403).json({ message: 'No autorizado para esta suscripción' });
    }

    if (sub.estadoPago === 'PAGADO') {
      return res.json({ message: 'Suscripción ya estaba pagada', sub });
    }

    const updatedSub = await prisma.pagoSuscripcion.update({
      where: { id: subId },
      data: {
        estadoPago: 'PAGADO',
        modalidad: 'Stripe',
        referencia: session.payment_intent as string || session.id,
        fechaPago: new Date()
      },
      include: {
        empresa: true
      }
    });

    res.json({ success: true, message: 'Pago verificado correctamente', sub: updatedSub });
  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ message: 'Error al confirmar pago: ' + error.message });
  }
});

// POST /api/suscripciones/webhook - Stripe Webhook handler
router.post('/webhook', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Fallback for development if signature is not configured
      event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any;
    
    if (session.payment_status === 'paid') {
      const subId = session.metadata?.pagoSuscripcionId;
      if (subId) {
        try {
          const sub = await prisma.pagoSuscripcion.findUnique({ where: { id: subId } });
          if (sub && sub.estadoPago !== 'PAGADO') {
            await prisma.pagoSuscripcion.update({
              where: { id: subId },
              data: {
                estadoPago: 'PAGADO',
                modalidad: 'Stripe',
                referencia: session.payment_intent as string || session.id,
                fechaPago: new Date()
              }
            });
            console.log(`[Stripe Webhook] Suscripción ${subId} marcada como PAGADA con éxito.`);
          }
        } catch (error) {
          console.error('[Stripe Webhook] Error al actualizar suscripción:', error);
        }
      }
    }
  }

  res.json({ received: true });
});

// PUT /api/suscripciones/:id/pagar - Register subscription payment (Manual by SUPER_ADMIN)
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
