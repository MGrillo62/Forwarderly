// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all costeos
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId, rol } = req.user!;
  
  try {
    const costeos = await prisma.costeoImportacion.findMany({
      where: { empresaId },
      include: {
        cliente: true,
        orden: {
          include: {
            cotizacion: {
              include: { cliente: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(costeos);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener costeos' });
  }
});

// Get single costeo
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const costeo = await prisma.costeoImportacion.findUnique({
      where: { id },
      include: {
        items: true,
        cliente: true,
        orden: {
          include: {
            cotizacion: {
              include: { lineas: { include: { concepto: true } } }
            }
          }
        }
      }
    });
    if (!costeo) return res.status(404).json({ message: 'Costeo no encontrado' });
    res.json(costeo);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener costeo' });
  }
});

// Create costeo
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const { 
    clienteId, clienteNombre, clienteDocumento, ordenId, 
    nroFacturaComercial, proveedorExtranjero, incoterm, moneda, 
    tipoCambio, observaciones, items, 
    totalFacturaComercial, gastosOrigen, fleteInternacional, seguro, gastosLocales,
    adValoremGlobal, percepcionPorcentaje,
    cifGlobal, baseImponible, igv, ipm, percepcionMonto, costoTotalImportacion
  } = req.body;

  try {
    // Generate code AAAA-99999
    const year = new Date().getFullYear();
    const count = await prisma.costeoImportacion.count({
      where: {
        empresaId,
        createdAt: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1)
        }
      }
    });
    const codigo = `${year}-${(count + 1).toString().padStart(5, '0')}`;

    const costeo = await prisma.costeoImportacion.create({
      data: {
        codigo,
        empresaId,
        clienteId,
        clienteNombre,
        clienteDocumento,
        ordenId,
        nroFacturaComercial,
        proveedorExtranjero,
        incoterm,
        moneda,
        tipoCambio: parseFloat(tipoCambio),
        observaciones,
        totalFacturaComercial: parseFloat(totalFacturaComercial),
        gastosOrigen: parseFloat(gastosOrigen || 0),
        fleteInternacional: parseFloat(fleteInternacional || 0),
        seguro: parseFloat(seguro || 0),
        gastosLocales: parseFloat(gastosLocales || 0),
        adValoremGlobal: parseFloat(adValoremGlobal || 0),
        percepcionPorcentaje: parseFloat(percepcionPorcentaje || 0),
        cifGlobal: parseFloat(cifGlobal),
        baseImponible: parseFloat(baseImponible),
        igv: parseFloat(igv),
        ipm: parseFloat(ipm),
        percepcionMonto: parseFloat(percepcionMonto),
        costoTotalImportacion: parseFloat(costoTotalImportacion),
        ratioImportacion: parseFloat(ratioImportacion || 0),
        items: {
          create: items.map((item: any) => ({
            sku: item.sku,
            producto: item.producto,
            cantidad: parseFloat(item.cantidad),
            valorUnitario: parseFloat(item.valorUnitario),
            valorTotal: parseFloat(item.valorTotal),
            adValoremPorcentaje: item.adValoremPorcentaje ? parseFloat(item.adValoremPorcentaje) : null,
            participacionPorcentual: parseFloat(item.participacionPorcentual),
            cifOculto: parseFloat(item.cifOculto),
            adValoremMonto: parseFloat(item.adValoremMonto),
            fleteUnitario: parseFloat(item.fleteUnitario),
            seguroUnitario: parseFloat(item.seguroUnitario),
            gastosOrigenUnitario: parseFloat(item.gastosOrigenUnitario),
            gastosLocalesUnitario: parseFloat(item.gastosLocalesUnitario),
            costoTotalUnitario: parseFloat(item.costoTotalUnitario),
            costoTotalSoles: parseFloat(item.costoTotalSoles),
            precioVentaPEN: parseFloat(item.precioVentaPEN || 0),
            descuentoPorcentaje: parseFloat(item.descuentoPorcentaje || 0),
            utilidadUnitarioPEN: parseFloat(item.utilidadUnitarioPEN || 0),
            utilidadTotalPEN: parseFloat(item.utilidadTotalPEN || 0),
            margenPorcentaje: parseFloat(item.margenPorcentaje || 0)
          }))
        }
      }
    });

    res.json(costeo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al crear costeo' });
  }
});

export default router;
