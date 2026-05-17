// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

const safeFloat = (v: any, def = 0) => { const n = parseFloat(v); return isNaN(n) ? def : n; };

// Get all costeos
router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  try {
    const costeos = await prisma.costeoImportacion.findMany({
      where: { empresaId },
      include: {
        cliente: true,
        items: true,
        orden: { include: { cotizacion: { include: { cliente: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(costeos);
  } catch (error: any) {
    console.error('GET costeos error:', error?.message);
    res.status(500).json({ message: error?.message || 'Error al obtener costeos' });
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
        orden: { include: { cotizacion: { include: { lineas: { include: { concepto: true } } } } } }
      }
    });
    if (!costeo) return res.status(404).json({ message: 'Costeo no encontrado' });
    res.json(costeo);
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Error al obtener costeo' });
  }
});

// Create costeo - uses raw SQL to bypass stale Prisma client enum validation
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId } = req.user!;
  const b = req.body;

  // Validate/normalize enums for raw SQL (no Prisma enum validation)
  const VALID_CANALES = ['VERDE', 'AMARILLO', 'ROJO', 'SIN_CANAL'];
  const VALID_MODALIDADES = ['AEREO', 'MARITIMO', 'MULTIMODAL'];
  const VALID_INCOTERMS = ['FOB', 'EXW', 'FCA'];
  const VALID_MONEDAS = ['USD', 'EUR'];

  const canal = b.canal && VALID_CANALES.includes(b.canal) ? b.canal : null;
  const modalidad = b.modalidad && VALID_MODALIDADES.includes(b.modalidad) ? b.modalidad : 'AEREO';
  const incoterm = b.incoterm && VALID_INCOTERMS.includes(b.incoterm) ? b.incoterm : 'FOB';
  const moneda = b.moneda && VALID_MONEDAS.includes(b.moneda) ? b.moneda : 'USD';
  const items = b.items || [];

  try {
    const year = new Date().getFullYear();
    const count = await prisma.costeoImportacion.count({
      where: { empresaId, createdAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
    });
    const codigo = `${year}-${(count + 1).toString().padStart(5, '0')}`;
    const id = randomUUID();
    const now = new Date().toISOString();

    // Raw SQL insert - bypasses all Prisma client enum validation with explicit type casts
    await prisma.$executeRawUnsafe(`
      INSERT INTO "CosteoImportacion" (
        id, codigo, "empresaId", "clienteId", "clienteNombre", "clienteDocumento",
        "ordenId", "nroFacturaComercial", "proveedorExtranjero",
        incoterm, moneda, "tipoCambio", observaciones,
        "totalFacturaComercial", "gastosOrigen", "fleteInternacional", seguro, "gastosLocales",
        "adValoremGlobal", "percepcionPorcentaje",
        "fechaEmbarque", "fechaLlegada", canal, modalidad, "nroDAM",
        "cifGlobal", "baseImponible", igv, ipm, "percepcionMonto",
        "costoTotalImportacion", "ratioImportacion",
        "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, cast($10 as "Incoterm"), cast($11 as "Moneda"), $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        cast($21 as timestamp), cast($22 as timestamp), cast($23 as "CanalImportacion"), cast($24 as "ModalidadImportacion"), $25, $26, $27, $28, $29, $30,
        $31, $32, NOW(), NOW()
      )`,
      id, codigo, empresaId,
      b.clienteId || null, b.clienteNombre || null, b.clienteDocumento || null,
      b.ordenId || null, b.nroFacturaComercial || null, b.proveedorExtranjero || null,
      incoterm, moneda, safeFloat(b.tipoCambio, 1), b.observaciones || null,
      safeFloat(b.totalFacturaComercial), safeFloat(b.gastosOrigen), safeFloat(b.fleteInternacional),
      safeFloat(b.seguro), safeFloat(b.gastosLocales),
      safeFloat(b.adValoremGlobal), safeFloat(b.percepcionPorcentaje),
      b.fechaEmbarque ? new Date(b.fechaEmbarque) : null,
      b.fechaLlegada ? new Date(b.fechaLlegada) : null,
      canal, modalidad, b.nroDAM || null,
      safeFloat(b.cifGlobal), safeFloat(b.baseImponible),
      safeFloat(b.igv), safeFloat(b.ipm), safeFloat(b.percepcionMonto),
      safeFloat(b.costoTotalImportacion), safeFloat(b.ratioImportacion)
    );

    // Insert items
    for (const item of items) {
      const itemId = randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CosteoImportacionItem" (
          id, "costeoId", sku, producto, cantidad, "valorUnitario", "valorTotal",
          "adValoremPorcentaje", "participacionPorcentual", "cifOculto", "adValoremMonto",
          "fleteUnitario", "seguroUnitario", "gastosOrigenUnitario", "gastosLocalesUnitario",
          "costoTotalUnitario", "costoTotalSoles",
          "precioVentaPEN", "descuentoPorcentaje", "utilidadUnitarioPEN", "utilidadTotalPEN", "margenPorcentaje",
          "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22, NOW(), NOW()
        )`,
        itemId, id,
        item.sku || '', item.producto || '',
        safeFloat(item.cantidad), safeFloat(item.valorUnitario), safeFloat(item.valorTotal),
        (item.adValoremPorcentaje !== '' && item.adValoremPorcentaje != null) ? safeFloat(item.adValoremPorcentaje) : null,
        safeFloat(item.participacionPorcentual), safeFloat(item.cifOculto), safeFloat(item.adValoremMonto),
        safeFloat(item.fleteUnitario), safeFloat(item.seguroUnitario),
        safeFloat(item.gastosOrigenUnitario), safeFloat(item.gastosLocalesUnitario),
        safeFloat(item.costoTotalUnitario), safeFloat(item.costoTotalSoles),
        safeFloat(item.precioVentaPEN), safeFloat(item.descuentoPorcentaje),
        safeFloat(item.utilidadUnitarioPEN), safeFloat(item.utilidadTotalPEN), safeFloat(item.margenPorcentaje)
      );
    }

    const costeo = await prisma.costeoImportacion.findUnique({ where: { id }, include: { items: true } });
    res.json(costeo);
  } catch (error: any) {
    console.error('ERROR CREAR COSTEO:', error?.message);
    res.status(500).json({ message: error?.message || 'Error al crear costeo' });
  }
});

// Update costeo - raw SQL
router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const b = req.body;

  const VALID_CANALES = ['VERDE', 'AMARILLO', 'ROJO', 'SIN_CANAL'];
  const VALID_MODALIDADES = ['AEREO', 'MARITIMO', 'MULTIMODAL'];
  const VALID_INCOTERMS = ['FOB', 'EXW', 'FCA'];
  const VALID_MONEDAS = ['USD', 'EUR'];

  const canal = b.canal && VALID_CANALES.includes(b.canal) ? b.canal : null;
  const modalidad = b.modalidad && VALID_MODALIDADES.includes(b.modalidad) ? b.modalidad : 'AEREO';
  const incoterm = b.incoterm && VALID_INCOTERMS.includes(b.incoterm) ? b.incoterm : 'FOB';
  const moneda = b.moneda && VALID_MONEDAS.includes(b.moneda) ? b.moneda : 'USD';
  const items = b.items || [];

  try {
    const now = new Date().toISOString();

    // Delete existing items
    await prisma.$executeRawUnsafe(`DELETE FROM "CosteoImportacionItem" WHERE "costeoId" = $1`, id);

    // Update costeo with raw SQL
    await prisma.$executeRawUnsafe(`
      UPDATE "CosteoImportacion" SET
        "clienteId" = $1, "clienteNombre" = $2, "clienteDocumento" = $3,
        "ordenId" = $4, "nroFacturaComercial" = $5, "proveedorExtranjero" = $6,
        incoterm = cast($7 as "Incoterm"), moneda = cast($8 as "Moneda"), "tipoCambio" = $9, observaciones = $10,
        "totalFacturaComercial" = $11, "gastosOrigen" = $12, "fleteInternacional" = $13,
        seguro = $14, "gastosLocales" = $15,
        "adValoremGlobal" = $16, "percepcionPorcentaje" = $17,
        "fechaEmbarque" = cast($18 as timestamp), "fechaLlegada" = cast($19 as timestamp),
        canal = cast($20 as "CanalImportacion"), modalidad = cast($21 as "ModalidadImportacion"), "nroDAM" = $22,
        "cifGlobal" = $23, "baseImponible" = $24, igv = $25, ipm = $26,
        "percepcionMonto" = $27, "costoTotalImportacion" = $28, "ratioImportacion" = $29,
        "updatedAt" = NOW()
      WHERE id = $30`,
      b.clienteId || null, b.clienteNombre || null, b.clienteDocumento || null,
      b.ordenId || null, b.nroFacturaComercial || null, b.proveedorExtranjero || null,
      incoterm, moneda, safeFloat(b.tipoCambio, 1), b.observaciones || null,
      safeFloat(b.totalFacturaComercial), safeFloat(b.gastosOrigen), safeFloat(b.fleteInternacional),
      safeFloat(b.seguro), safeFloat(b.gastosLocales),
      safeFloat(b.adValoremGlobal), safeFloat(b.percepcionPorcentaje),
      b.fechaEmbarque ? new Date(b.fechaEmbarque) : null,
      b.fechaLlegada ? new Date(b.fechaLlegada) : null,
      canal, modalidad, b.nroDAM || null,
      safeFloat(b.cifGlobal), safeFloat(b.baseImponible),
      safeFloat(b.igv), safeFloat(b.ipm), safeFloat(b.percepcionMonto),
      safeFloat(b.costoTotalImportacion), safeFloat(b.ratioImportacion),
      id
    );

    // Insert new items
    for (const item of items) {
      const itemId = randomUUID();
      await prisma.$executeRawUnsafe(`
        INSERT INTO "CosteoImportacionItem" (
          id, "costeoId", sku, producto, cantidad, "valorUnitario", "valorTotal",
          "adValoremPorcentaje", "participacionPorcentual", "cifOculto", "adValoremMonto",
          "fleteUnitario", "seguroUnitario", "gastosOrigenUnitario", "gastosLocalesUnitario",
          "costoTotalUnitario", "costoTotalSoles",
          "precioVentaPEN", "descuentoPorcentaje", "utilidadUnitarioPEN", "utilidadTotalPEN", "margenPorcentaje",
          "createdAt", "updatedAt"
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22, NOW(), NOW()
        )`,
        itemId, id,
        item.sku || '', item.producto || '',
        safeFloat(item.cantidad), safeFloat(item.valorUnitario), safeFloat(item.valorTotal),
        (item.adValoremPorcentaje !== '' && item.adValoremPorcentaje != null) ? safeFloat(item.adValoremPorcentaje) : null,
        safeFloat(item.participacionPorcentual), safeFloat(item.cifOculto), safeFloat(item.adValoremMonto),
        safeFloat(item.fleteUnitario), safeFloat(item.seguroUnitario),
        safeFloat(item.gastosOrigenUnitario), safeFloat(item.gastosLocalesUnitario),
        safeFloat(item.costoTotalUnitario), safeFloat(item.costoTotalSoles),
        safeFloat(item.precioVentaPEN), safeFloat(item.descuentoPorcentaje),
        safeFloat(item.utilidadUnitarioPEN), safeFloat(item.utilidadTotalPEN), safeFloat(item.margenPorcentaje)
      );
    }

    const costeo = await prisma.costeoImportacion.findUnique({ where: { id }, include: { items: true } });
    res.json(costeo);
  } catch (error: any) {
    console.error('ERROR ACTUALIZAR COSTEO:', error?.message);
    res.status(500).json({ message: error?.message || 'Error al actualizar costeo' });
  }
});

// Change estado - raw SQL to bypass Prisma client version issues
router.patch('/:id/estado', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { estado } = req.body;
  const estadoValido = estado === 'TERMINADO' ? 'TERMINADO' : 'BORRADOR';
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "CosteoImportacion" SET estado = cast($1 as "CosteoEstado"), "updatedAt" = NOW() WHERE id = $2`,
      estadoValido, id
    );
    const costeo = await prisma.costeoImportacion.findUnique({ where: { id } });
    res.json(costeo);
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Error al cambiar estado' });
  }
});

// Delete costeo
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM "CosteoImportacionItem" WHERE "costeoId" = $1`, id);
    await prisma.$executeRawUnsafe(`DELETE FROM "CosteoImportacion" WHERE id = $1`, id);
    res.json({ message: 'Costeo eliminado correctamente' });
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Error al eliminar costeo' });
  }
});

export default router;
