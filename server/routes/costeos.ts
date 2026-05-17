// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

// Get all costeos
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  
  try {
    const costeos = await prisma.costeoImportacion.findMany({
      where: { empresaId },
      include: {
        cliente: true,
        items: true, // Including items for quick view, or could be fetched on demand
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
    fechaEmbarque, fechaLlegada, canal, modalidad, nroDAM,
    cifGlobal, baseImponible, igv, ipm, percepcionMonto, costoTotalImportacion, ratioImportacion, estado
  } = req.body;

  // Normalizar canal: SIN_CANAL -> null, y validar enum
  const validCanales = ['VERDE', 'AMARILLO', 'ROJO'];
  const canalNormalizado = canal && validCanales.includes(canal) ? canal : null;

  // Normalizar modalidad
  const validModalidades = ['AEREO', 'MARITIMO', 'MULTIMODAL'];
  const modalidadNormalizada = modalidad && validModalidades.includes(modalidad) ? modalidad : 'AEREO';

  // Normalizar incoterm
  const validIncoterms = ['FOB', 'EXW', 'FCA'];
  const incotermNormalizado = incoterm && validIncoterms.includes(incoterm) ? incoterm : 'FOB';

  // Normalizar moneda
  const validMonedas = ['USD', 'EUR'];
  const monedaNormalizada = moneda && validMonedas.includes(moneda) ? moneda : 'USD';

  const safeFloat = (v: any, def = 0) => { const n = parseFloat(v); return isNaN(n) ? def : n; };

  try {
    const year = new Date().getFullYear();
    const count = await prisma.costeoImportacion.count({
      where: {
        empresaId,
        createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
      }
    });
    const codigo = `${year}-${(count + 1).toString().padStart(5, '0')}`;

    const costeo = await prisma.costeoImportacion.create({
      data: {
        codigo,
        empresaId,
        clienteId: clienteId || null,
        clienteNombre: clienteNombre || '',
        clienteDocumento: clienteDocumento || null,
        ordenId: ordenId || null,
        nroFacturaComercial: nroFacturaComercial || null,
        proveedorExtranjero: proveedorExtranjero || null,
        incoterm: incotermNormalizado as any,
        moneda: monedaNormalizada as any,
        tipoCambio: safeFloat(tipoCambio, 1),
        observaciones: observaciones || null,
        totalFacturaComercial: safeFloat(totalFacturaComercial),
        gastosOrigen: safeFloat(gastosOrigen),
        fleteInternacional: safeFloat(fleteInternacional),
        seguro: safeFloat(seguro),
        gastosLocales: safeFloat(gastosLocales),
        adValoremGlobal: safeFloat(adValoremGlobal),
        percepcionPorcentaje: safeFloat(percepcionPorcentaje),
        fechaEmbarque: fechaEmbarque ? new Date(fechaEmbarque) : null,
        fechaLlegada: fechaLlegada ? new Date(fechaLlegada) : null,
        canal: canalNormalizado as any,
        modalidad: modalidadNormalizada as any,
        nroDAM: nroDAM || null,
        ...(estado ? { estado: (estado === 'TERMINADO' ? 'TERMINADO' : 'BORRADOR') } : {}),
        cifGlobal: safeFloat(cifGlobal),
        baseImponible: safeFloat(baseImponible),
        igv: safeFloat(igv),
        ipm: safeFloat(ipm),
        percepcionMonto: safeFloat(percepcionMonto),
        costoTotalImportacion: safeFloat(costoTotalImportacion),
        ratioImportacion: safeFloat(ratioImportacion),
        items: {
          create: (items || []).map((item: any) => ({
            sku: item.sku || '',
            producto: item.producto || '',
            cantidad: safeFloat(item.cantidad),
            valorUnitario: safeFloat(item.valorUnitario),
            valorTotal: safeFloat(item.valorTotal),
            adValoremPorcentaje: (item.adValoremPorcentaje !== '' && item.adValoremPorcentaje != null) ? safeFloat(item.adValoremPorcentaje) : null,
            participacionPorcentual: safeFloat(item.participacionPorcentual),
            cifOculto: safeFloat(item.cifOculto),
            adValoremMonto: safeFloat(item.adValoremMonto),
            fleteUnitario: safeFloat(item.fleteUnitario),
            seguroUnitario: safeFloat(item.seguroUnitario),
            gastosOrigenUnitario: safeFloat(item.gastosOrigenUnitario),
            gastosLocalesUnitario: safeFloat(item.gastosLocalesUnitario),
            costoTotalUnitario: safeFloat(item.costoTotalUnitario),
            costoTotalSoles: safeFloat(item.costoTotalSoles),
            precioVentaPEN: safeFloat(item.precioVentaPEN),
            descuentoPorcentaje: safeFloat(item.descuentoPorcentaje),
            utilidadUnitarioPEN: safeFloat(item.utilidadUnitarioPEN),
            utilidadTotalPEN: safeFloat(item.utilidadTotalPEN),
            margenPorcentaje: safeFloat(item.margenPorcentaje)
          }))
        }
      }
    });

    res.json(costeo);
  } catch (error: any) {
    console.error('ERROR CREAR COSTEO:', JSON.stringify(error?.message || error, null, 2));
    res.status(500).json({ message: error?.message || 'Error al crear costeo' });
  }
});

// Update costeo
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { 
    clienteId, clienteNombre, clienteDocumento, ordenId, 
    nroFacturaComercial, proveedorExtranjero, incoterm, moneda, 
    tipoCambio, observaciones, items, 
    totalFacturaComercial, gastosOrigen, fleteInternacional, seguro, gastosLocales,
    adValoremGlobal, percepcionPorcentaje,
    fechaEmbarque, fechaLlegada, canal, modalidad, nroDAM,
    cifGlobal, baseImponible, igv, ipm, percepcionMonto, costoTotalImportacion, ratioImportacion, estado
  } = req.body;

  const validCanales = ['VERDE', 'AMARILLO', 'ROJO'];
  const canalNormalizado = canal && validCanales.includes(canal) ? canal : null;
  const validModalidades = ['AEREO', 'MARITIMO', 'MULTIMODAL'];
  const modalidadNormalizada = modalidad && validModalidades.includes(modalidad) ? modalidad : 'AEREO';
  const validIncoterms = ['FOB', 'EXW', 'FCA'];
  const incotermNormalizado = incoterm && validIncoterms.includes(incoterm) ? incoterm : 'FOB';
  const validMonedas = ['USD', 'EUR'];
  const monedaNormalizada = moneda && validMonedas.includes(moneda) ? moneda : 'USD';
  const safeFloat = (v: any, def = 0) => { const n = parseFloat(v); return isNaN(n) ? def : n; };

  try {
    await prisma.costeoImportacionItem.deleteMany({ where: { costeoId: id } });

    const costeo = await prisma.costeoImportacion.update({
      where: { id },
      data: {
        clienteId: clienteId || null,
        clienteNombre: clienteNombre || '',
        clienteDocumento: clienteDocumento || null,
        ordenId: ordenId || null,
        nroFacturaComercial: nroFacturaComercial || null,
        proveedorExtranjero: proveedorExtranjero || null,
        incoterm: incotermNormalizado as any,
        moneda: monedaNormalizada as any,
        tipoCambio: safeFloat(tipoCambio, 1),
        observaciones: observaciones || null,
        totalFacturaComercial: safeFloat(totalFacturaComercial),
        gastosOrigen: safeFloat(gastosOrigen),
        fleteInternacional: safeFloat(fleteInternacional),
        seguro: safeFloat(seguro),
        gastosLocales: safeFloat(gastosLocales),
        adValoremGlobal: safeFloat(adValoremGlobal),
        percepcionPorcentaje: safeFloat(percepcionPorcentaje),
        fechaEmbarque: fechaEmbarque ? new Date(fechaEmbarque) : null,
        fechaLlegada: fechaLlegada ? new Date(fechaLlegada) : null,
        canal: canalNormalizado as any,
        modalidad: modalidadNormalizada as any,
        nroDAM: nroDAM || null,
        estado: (estado === 'TERMINADO' ? 'TERMINADO' : 'BORRADOR') as any,
        cifGlobal: safeFloat(cifGlobal),
        baseImponible: safeFloat(baseImponible),
        igv: safeFloat(igv),
        ipm: safeFloat(ipm),
        percepcionMonto: safeFloat(percepcionMonto),
        costoTotalImportacion: safeFloat(costoTotalImportacion),
        ratioImportacion: safeFloat(ratioImportacion),
        items: {
          create: (items || []).map((item: any) => ({
            sku: item.sku || '',
            producto: item.producto || '',
            cantidad: safeFloat(item.cantidad),
            valorUnitario: safeFloat(item.valorUnitario),
            valorTotal: safeFloat(item.valorTotal),
            adValoremPorcentaje: (item.adValoremPorcentaje !== '' && item.adValoremPorcentaje != null) ? safeFloat(item.adValoremPorcentaje) : null,
            participacionPorcentual: safeFloat(item.participacionPorcentual),
            cifOculto: safeFloat(item.cifOculto),
            adValoremMonto: safeFloat(item.adValoremMonto),
            fleteUnitario: safeFloat(item.fleteUnitario),
            seguroUnitario: safeFloat(item.seguroUnitario),
            gastosOrigenUnitario: safeFloat(item.gastosOrigenUnitario),
            gastosLocalesUnitario: safeFloat(item.gastosLocalesUnitario),
            costoTotalUnitario: safeFloat(item.costoTotalUnitario),
            costoTotalSoles: safeFloat(item.costoTotalSoles),
            precioVentaPEN: safeFloat(item.precioVentaPEN),
            descuentoPorcentaje: safeFloat(item.descuentoPorcentaje),
            utilidadUnitarioPEN: safeFloat(item.utilidadUnitarioPEN),
            utilidadTotalPEN: safeFloat(item.utilidadTotalPEN),
            margenPorcentaje: safeFloat(item.margenPorcentaje)
          }))
        }
      }
    });

    res.json(costeo);
  } catch (error: any) {
    console.error('ERROR ACTUALIZAR COSTEO:', JSON.stringify(error?.message || error, null, 2));
    res.status(500).json({ message: error?.message || 'Error al actualizar costeo' });
  }
});

// Change estado only
router.patch('/:id/estado', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  try {
    const costeo = await prisma.costeoImportacion.update({
      where: { id },
      data: { estado }
    });
    res.json(costeo);
  } catch (error) {
    res.status(500).json({ message: 'Error al cambiar estado' });
  }
});

// Delete costeo
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await prisma.costeoImportacion.delete({ where: { id } });
    res.json({ message: 'Costeo eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar costeo' });
  }
});

export default router;
