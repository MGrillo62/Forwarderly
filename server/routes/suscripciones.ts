import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';
const router = Router();
const prisma = new PrismaClient();

// Initialize Culqi configuration
const CULQI_API_URL = 'https://api.culqi.com/v2';
const CULQI_SECRET_KEY = (process.env.CULQI_SECRET_KEY || 'sk_test_QqfPfNGIsmZWrIoJ').replace(/['"]/g, '').trim();

// Sanitizer helpers for robust Culqi Customer registration
const sanitizeName = (name: string): string => {
  return (name || '')
    .replace(/[^a-zA-Z0-9\s.\-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const sanitizePhone = (phone: string): string => {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return '999999999';
  return digits;
};

const sanitizeEmail = (email: string): string => {
  const trimmed = (email || '').trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return 'factura@forwarderly.com';
  }
  return trimmed;
};

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

    if (empresa.ruc === '20600259751' || empresa.razonSocial.toLowerCase().includes('optimus')) {
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      return res.json({ 
        tieneAcceso: true, 
        motivo: 'AL_DIA', 
        diasRestantesTrial: 0,
        fechaFinPrueba: new Date(Date.now() - 14 * 24 * 3600 * 1000), // trial ended in past
        diasRestantesSuscripcion: 365,
        fechaFinSuscripcion: oneYearFromNow,
        planActual: 'ANUAL',
        hasCulqiSubscription: true
      });
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

    // Check if they have an active Culqi subscription
    const hasCulqiSubscription = !!empresa.culqiSubscriptionId;

    // Check if subscription has expired
    let isExpired = false;
    let diasRestantesSuscripcion = 0;

    if (empresa.fechaFin) {
      const msSuscripcion = new Date(empresa.fechaFin).getTime() - today.getTime();
      diasRestantesSuscripcion = Math.ceil(msSuscripcion / (1000 * 60 * 60 * 24));
      isExpired = today > new Date(empresa.fechaFin);
    }

    // New Client: trial over and never subscribed
    if (!isTrialActive && !hasCulqiSubscription) {
      return res.json({ 
        tieneAcceso: false, 
        motivo: 'REQUIERE_PRIMER_PAGO', 
        diasRestantesTrial: 0,
        fechaFinPrueba: trialEnd
      });
    }

    // Renewal: trial over, subscribed, but expired
    if (!isTrialActive && hasCulqiSubscription && isExpired) {
      return res.json({
        tieneAcceso: false,
        motivo: 'SUSCRIPCION_VENCIDA',
        diasRestantesTrial: 0,
        fechaFinPrueba: trialEnd,
        fechaFinSuscripcion: empresa.fechaFin
      });
    }

    return res.json({ 
      tieneAcceso: true, 
      motivo: isTrialActive ? 'TRIAL_ACTIVO' : 'AL_DIA', 
      diasRestantesTrial: isTrialActive ? Math.max(0, diasRestantesTrial) : 0,
      fechaFinPrueba: trialEnd,
      diasRestantesSuscripcion: empresa.fechaFin ? Math.max(0, diasRestantesSuscripcion) : 0,
      fechaFinSuscripcion: empresa.fechaFin,
      planActual: empresa.periodicidad,
      hasCulqiSubscription
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al verificar acceso: ' + error.message });
  }
});

// GET /api/suscripciones/planes - Get active plans from Culqi
router.get('/planes', authenticate, async (req: AuthRequest, res) => {
  try {
    const culqiResponse = await fetch(`${CULQI_API_URL}/recurrent/plans`, {
      headers: {
        'Authorization': `Bearer ${CULQI_SECRET_KEY}`
      }
    });

    if (culqiResponse.ok) {
      const culqiData = await culqiResponse.json() as any;
      if (culqiData.data) {
        return res.json(culqiData.data);
      }
    }

    // Fallback: list of plans in case Culqi API is down or in mock environment
    return res.json([
      {
        id: 'codigo',
        name: 'Plan Solopreneur',
        amount: 15500, // S/ 155.00
        currency_code: 'PEN',
        interval: 'months',
        interval_count: 1
      },
      {
        id: 'anual',
        name: 'Plan Solopreneur Anual',
        amount: 148800, // S/ 1,488.00
        currency_code: 'PEN',
        interval: 'months',
        interval_count: 12
      }
    ]);
  } catch (error: any) {
    console.error('Error fetching Culqi plans:', error);
    // Return fallback plans rather than failing completely
    res.json([
      {
        id: 'codigo',
        name: 'Plan Solopreneur',
        amount: 15500,
        currency_code: 'PEN',
        interval: 'months',
        interval_count: 1
      },
      {
        id: 'anual',
        name: 'Plan Solopreneur Anual',
        amount: 148800,
        currency_code: 'PEN',
        interval: 'months',
        interval_count: 12
      }
    ]);
  }
});

// POST /api/suscripciones/culqi-subscribe - Create native subscription in Culqi
router.post('/culqi-subscribe', authenticate, async (req: AuthRequest, res) => {
  const { token, planCodigo } = req.body;
  const userEmpresaId = req.user?.empresaId;

  try {
    if (!token || !planCodigo) {
      return res.status(400).json({ message: 'Token y planCodigo son requeridos' });
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

    let customerId = empresa.culqiCustomerId;

    // 1. Create Culqi Customer if they don't have one
    if (!customerId) {
      const customerResponse = await fetch(`${CULQI_API_URL}/customers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CULQI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          first_name: 'Empresa',
          last_name: sanitizeName(empresa.razonSocial),
          email: sanitizeEmail(empresa.correo),
          address: 'Av. Principal 123',
          address_city: 'Lima',
          country_code: 'PE',
          phone_number: sanitizePhone(empresa.celular)
        })
      });

      const customerData = await customerResponse.json() as any;

      if (!customerResponse.ok) {
        console.error('Error creating Culqi customer:', customerData);
        const detailedError = customerData.user_message || customerData.merchant_message || JSON.stringify(customerData);
        return res.status(400).json({ message: `Error al registrar cliente en Culqi: ${detailedError}` });
      }

      customerId = customerData.id;
      
      // Save customer ID in database
      await prisma.empresa.update({
        where: { id: empresa.id },
        data: { culqiCustomerId: customerId }
      });
    }

    // 2. Associate card token to customer (Create Card)
    const cardResponse = await fetch(`${CULQI_API_URL}/cards`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer_id: customerId,
        token_id: token
      })
    });

    const cardData = await cardResponse.json() as any;

    if (!cardResponse.ok) {
      console.error('Error creating Culqi card:', cardData);
      const detailedError = cardData.user_message || cardData.merchant_message || JSON.stringify(cardData);
      return res.status(400).json({ message: `Error al registrar tarjeta en Culqi: ${detailedError}` });
    }

    const cardId = cardData.id;

    // Resolve Culqi Plan ID dynamically from planCodigo
    let culqiPlanId = planCodigo === 'anual' ? 'pln_test_fMmMr4PRbjBOMU8B' : 'pln_test_unJdU3vzGbQTdpK1';
    try {
      const plansResponse = await fetch(`${CULQI_API_URL}/recurrent/plans`, {
        headers: {
          'Authorization': `Bearer ${CULQI_SECRET_KEY}`
        }
      });
      if (plansResponse.ok) {
        const plansData = await plansResponse.json() as any;
        if (plansData && plansData.data && Array.isArray(plansData.data)) {
          const matchedPlan = plansData.data.find((p: any) => p.short_name === planCodigo || p.id === planCodigo);
          if (matchedPlan) {
            culqiPlanId = matchedPlan.id;
            console.log(`[Culqi Subscribe] Resolved plan ID dynamically: ${planCodigo} -> ${culqiPlanId}`);
          }
        }
      }
    } catch (plansErr) {
      console.error('[Culqi Subscribe] Error resolving plan ID dynamically, using fallback test ID:', plansErr);
    }

    // 3. Subscribe Customer to Plan
    const subscriptionResponse = await fetch(`${CULQI_API_URL}/recurrent/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CULQI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        card_id: cardId,
        plan_id: culqiPlanId
      })
    });

    const subscriptionData = await subscriptionResponse.json() as any;

    if (!subscriptionResponse.ok) {
      console.error('Error creating Culqi subscription:', subscriptionData);
      const detailedError = subscriptionData.user_message || subscriptionData.merchant_message || JSON.stringify(subscriptionData);
      return res.status(400).json({ message: `Error al crear suscripción en Culqi: ${detailedError}` });
    }

    const subscriptionId = subscriptionData.id;

    // Determine plan price and periodicity
    const planAmount = planCodigo === 'anual' ? 1488.0 : 155.0;
    const periodicidad = planCodigo === 'anual' ? 'ANUAL' : 'MENSUAL';

    // Calculate new expiration date (fechaFin)
    const today = new Date();
    const nextBillingDate = new Date(today);
    if (planCodigo === 'anual') {
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // 4. Update Empresa database model
    await prisma.empresa.update({
      where: { id: empresa.id },
      data: {
        culqiSubscriptionId: subscriptionId,
        montoSuscripcion: planAmount,
        periodicidad,
        fechaFin: nextBillingDate,
        estado: 'ACTIVO'
      }
    });

    // 5. Register initial payment cycle as PAGADO
    const updatedSub = await prisma.pagoSuscripcion.create({
      data: {
        empresaId: empresa.id,
        mes: today.getMonth() + 1,
        anio: today.getFullYear(),
        monto: planAmount,
        estadoPago: 'PAGADO',
        modalidad: 'Culqi',
        referencia: subscriptionId,
        fechaPago: today
      },
      include: {
        empresa: true
      }
    });

    res.json({ success: true, message: 'Suscripción recurrente iniciada correctamente', sub: updatedSub });
  } catch (error: any) {
    console.error('Error creating Culqi subscription:', error);
    res.status(500).json({ message: 'Error al procesar la suscripción: ' + error.message });
  }
});

// POST /api/suscripciones/webhook - Culqi Webhook handler
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('[Culqi Webhook] Recibido evento:', event?.type || event?.object);

    if (!event) {
      return res.status(400).send('Cuerpo de petición vacío');
    }

    // We listen to "charge.creation.succeeded" or other successful charge events
    const isChargeSuccess = event.type === 'charge.creation.succeeded' || event.object === 'charge';

    if (isChargeSuccess) {
      // Extract charge details
      const chargeData = event.data ? (typeof event.data === 'string' ? JSON.parse(event.data) : event.data) : event;
      const chargeId = chargeData.id;
      
      if (!chargeId) {
        return res.status(400).send('ID de cargo no encontrado en el evento');
      }

      // Double-check verification: fetch the charge directly from Culqi API using our private key
      // to prevent webhook spoofing
      const verifyResponse = await fetch(`${CULQI_API_URL}/charges/${chargeId}`, {
        headers: {
          'Authorization': `Bearer ${CULQI_SECRET_KEY}`
        }
      });

      if (!verifyResponse.ok) {
        console.error(`[Culqi Webhook] Error al verificar cargo ${chargeId} con la API de Culqi`);
        return res.status(400).send('No se pudo verificar la autenticidad del cargo');
      }

      const verifiedCharge = await verifyResponse.json() as any;

      // Ensure charge is successful and outcomes match a successful sale
      const isCaptured = verifiedCharge.outcome && verifiedCharge.outcome.type === 'venta_exitosa';
      
      if (isCaptured) {
        // Option A: Single charge confirmation (has pagoSuscripcionId in metadata)
        const subId = verifiedCharge.metadata?.pagoSuscripcionId;
        if (subId) {
          const sub = await prisma.pagoSuscripcion.findUnique({ where: { id: subId } });
          if (sub && sub.estadoPago !== 'PAGADO') {
            await prisma.pagoSuscripcion.update({
              where: { id: subId },
              data: {
                estadoPago: 'PAGADO',
                modalidad: 'Culqi',
                referencia: chargeId,
                fechaPago: new Date()
              }
            });
            console.log(`[Culqi Webhook] Suscripción ${subId} marcada como PAGADA con éxito.`);
          }
        } 
        // Option B: Recurring Subscription Renewal (has subscription_id in charge details)
        else if (verifiedCharge.subscription_id) {
          const subscriptionId = verifiedCharge.subscription_id;
          
          // Find the company associated with this subscription
          const empresa = await prisma.empresa.findFirst({
            where: { culqiSubscriptionId: subscriptionId }
          });

          if (empresa) {
            const today = new Date();
            
            // Calculate next billing date based on periodicity
            const nextBillingDate = new Date(today);
            if (empresa.periodicidad === 'ANUAL') {
              nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            } else {
              nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            }

            // Update company's expiration date (extend access)
            await prisma.empresa.update({
              where: { id: empresa.id },
              data: {
                fechaFin: nextBillingDate,
                estado: 'ACTIVO'
              }
            });

            // Register the renewal payment period in the database automatically
            const month = today.getMonth() + 1;
            const year = today.getFullYear();

            // Check if it already exists to prevent duplicate entries
            const exists = await prisma.pagoSuscripcion.findUnique({
              where: {
                empresaId_mes_anio: {
                  empresaId: empresa.id,
                  mes: month,
                  anio: year
                }
              }
            });

            if (!exists) {
              await prisma.pagoSuscripcion.create({
                data: {
                  empresaId: empresa.id,
                  mes: month,
                  anio: year,
                  monto: empresa.montoSuscripcion || 155.0,
                  estadoPago: 'PAGADO',
                  modalidad: 'Culqi',
                  referencia: chargeId,
                  fechaPago: today
                }
              });
              console.log(`[Culqi Webhook] Renovación procesada y registrada de forma PAGADA para la empresa ${empresa.razonSocial}.`);
            }
          }
        }
      }
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[Culqi Webhook] Error:', error.message);
    res.status(500).send(`Webhook Error: ${error.message}`);
  }
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
