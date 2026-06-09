// @ts-nocheck
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';
import multer from 'multer';
import { cloudinary } from '../utils/cloudinary';
import { Readable } from 'stream';

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

// Update concept lines document details for an order
router.put('/:id/lineas-documentos', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { detallesLineas } = req.body;

  try {
    if (!detallesLineas || typeof detallesLineas !== 'object') {
      return res.status(400).json({ message: 'detallesLineas es requerido y debe ser un objeto' });
    }

    const updates = Object.entries(detallesLineas).map(async ([lineId, doc]: any) => {
      const fecha = doc.fechaDocumento ? new Date(doc.fechaDocumento) : null;
      return prisma.cotizacionLinea.update({
        where: { id: lineId },
        data: {
          tipoDocumento: doc.tipoDocumento || null,
          nroDocumento: doc.nroDocumento || null,
          fechaDocumento: fecha
        }
      });
    });

    await Promise.all(updates);
    res.json({ message: 'Comprobantes de pago guardados exitosamente.' });
  } catch (error: any) {
    console.error('Error al guardar comprobantes de pago:', error);
    res.status(500).json({ message: 'Error al guardar comprobantes de pago: ' + error.message });
  }
});

// Eliminar orden
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { rol } = req.user!;

  try {
    if (rol !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'No tiene permisos para eliminar órdenes' });
    }

    const existing = await prisma.orden.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    // Explicitly update associated cotizaciones to set ordenId / cotizacionId to null
    await prisma.cotizacion.updateMany({
      where: { ordenId: id },
      data: { ordenId: null }
    });

    // Clear costeo's ordenId reference if any
    await prisma.costeoImportacion.updateMany({
      where: { ordenId: id },
      data: { ordenId: null }
    });

    // Delete related records
    await prisma.ordenEstadoHistorial.deleteMany({ where: { ordenId: id } });
    await prisma.ordenPago.deleteMany({ where: { ordenId: id } });
    await prisma.cobro.deleteMany({ where: { ordenId: id } });

    // Finally delete the Orden
    await prisma.orden.delete({
      where: { id }
    });

    res.json({ message: 'Orden eliminada correctamente' });
  } catch (error: any) {
    console.error('Error al eliminar orden:', error);
    res.status(500).json({ message: 'Error al eliminar orden: ' + error.message });
  }
});

// Configure multer
const upload = multer({ storage: multer.memoryStorage() });

// Helper functions to parse Cloudinary URL and delete file
function getPublicIdFromUrl(url: string): string | null {
  try {
    if (!url.includes('cloudinary.com')) return null;
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    let publicIdWithExt = parts[1];
    const versionMatch = publicIdWithExt.match(/^v\d+\/(.+)$/);
    if (versionMatch) {
      publicIdWithExt = versionMatch[1];
    }
    
    const lastDotIndex = publicIdWithExt.lastIndexOf('.');
    if (lastDotIndex !== -1) {
      return publicIdWithExt.substring(0, lastDotIndex);
    }
    return publicIdWithExt;
  } catch (error) {
    console.error('Error parsing public_id from Cloudinary URL:', error);
    return null;
  }
}

function getResourceTypeFromUrl(url: string): string {
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return 'image';
    const urlBeforeUpload = parts[0];
    const slashParts = urlBeforeUpload.split('/');
    const resourceType = slashParts[slashParts.length - 1];
    if (['image', 'raw', 'video'].includes(resourceType)) {
      return resourceType;
    }
    return 'image';
  } catch (error) {
    return 'image';
  }
}

async function deleteFileFromCloudinary(url: string): Promise<boolean> {
  if (!url) return false;
  const isCloudinaryConfigured = !!(
    process.env.CLOUDINARY_URL || 
    (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
  );

  if (!isCloudinaryConfigured) {
    console.log('Cloudinary not configured. Skipping file deletion.');
    return true;
  }

  const publicId = getPublicIdFromUrl(url);
  const resourceType = getResourceTypeFromUrl(url);
  if (!publicId) return false;

  try {
    console.log(`Deleting file from Cloudinary: ${publicId} (${resourceType})`);
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    console.log('Cloudinary deletion result:', result);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting file from Cloudinary:', error);
    return false;
  }
}

// Get all documents for an order
router.get('/:id/documentos', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { empresaId } = req.user!;

  try {
    const orden = await prisma.orden.findFirst({
      where: {
        id,
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      }
    });

    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada o no pertenece a su empresa' });
    }

    const documentos = await prisma.ordenDocumento.findMany({
      where: { ordenId: id },
      include: { tipoDocumento: true },
      orderBy: { tipoDocumento: { nombre: 'asc' } }
    });

    res.json(documentos);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener documentos: ' + error.message });
  }
});

// Associate document types to an order
router.post('/:id/documentos', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { tipoDocumentoIds } = req.body;
  const { empresaId } = req.user!;

  try {
    if (!tipoDocumentoIds || !Array.isArray(tipoDocumentoIds)) {
      return res.status(400).json({ message: 'Se requiere una lista de IDs de tipos de documentos' });
    }

    const orden = await prisma.orden.findFirst({
      where: {
        id,
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      }
    });

    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada o no pertenece a su empresa' });
    }

    const validTypes = await prisma.tipoDocumento.findMany({
      where: {
        id: { in: tipoDocumentoIds },
        empresaId
      }
    });

    if (validTypes.length !== tipoDocumentoIds.length) {
      return res.status(400).json({ message: 'Algunos tipos de documentos no son válidos' });
    }

    const creations = tipoDocumentoIds.map(async (tipoId) => {
      return prisma.ordenDocumento.upsert({
        where: {
          ordenId_tipoDocumentoId: {
            ordenId: id,
            tipoDocumentoId: tipoId
          }
        },
        create: {
          ordenId: id,
          tipoDocumentoId: tipoId
        },
        update: {}
      });
    });

    await Promise.all(creations);

    const actualizados = await prisma.ordenDocumento.findMany({
      where: { ordenId: id },
      include: { tipoDocumento: true },
      orderBy: { tipoDocumento: { nombre: 'asc' } }
    });

    res.json(actualizados);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al asociar documentos: ' + error.message });
  }
});

// Delete a document slot / requirement from an order
router.delete('/:id/documentos/:documentoId', authenticate, async (req: AuthRequest, res) => {
  const { id: ordenId, documentoId } = req.params;
  const { empresaId } = req.user!;

  try {
    const orden = await prisma.orden.findFirst({
      where: {
        id: ordenId,
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      }
    });

    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const docReq = await prisma.ordenDocumento.findUnique({
      where: { id: documentoId }
    });

    if (!docReq || docReq.ordenId !== ordenId) {
      return res.status(404).json({ message: 'Documento no encontrado en esta orden' });
    }

    if (docReq.url) {
      await deleteFileFromCloudinary(docReq.url);
    }

    await prisma.ordenDocumento.delete({
      where: { id: documentoId }
    });

    res.json({ message: 'Requerimiento de documento eliminado' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar requerimiento: ' + error.message });
  }
});

// Upload document file to Cloudinary / Mock
router.post('/:id/documentos/:documentoId/subir', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  const { id: ordenId, documentoId } = req.params;
  const { empresaId } = req.user!;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Debe adjuntar un archivo' });
    }

    const orden = await prisma.orden.findFirst({
      where: {
        id: ordenId,
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      },
      include: {
        cotizacion: {
          include: { cliente: true, lead: true }
        },
        cotizacionesAsociadas: {
          include: { cliente: true, lead: true }
        }
      }
    });

    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada o no pertenece a su empresa' });
    }

    const docReq = await prisma.ordenDocumento.findUnique({
      where: { id: documentoId }
    });

    if (!docReq || docReq.ordenId !== ordenId) {
      return res.status(404).json({ message: 'Requerimiento no encontrado' });
    }

    let fileUrl = '';
    const originalName = req.file.originalname;

    let clienteNombre = 'Sin_Cliente';
    if (orden.cotizacion?.cliente) {
      clienteNombre = orden.cotizacion.cliente.razonSocial;
    } else if (orden.cotizacion?.lead) {
      clienteNombre = orden.cotizacion.lead.nombre || orden.cotizacion.lead.contacto || 'Sin_Cliente';
    } else if (orden.cotizacionesAsociadas && orden.cotizacionesAsociadas.length > 0) {
      const first = orden.cotizacionesAsociadas[0];
      if (first.cliente) {
        clienteNombre = first.cliente.razonSocial;
      } else if (first.lead) {
        clienteNombre = first.lead.nombre || first.lead.contacto || 'Sin_Cliente';
      }
    }

    const clientNameSanitized = clienteNombre
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-_]/g, '')
      .replace(/\s+/g, '_');

    const folderPath = `${process.env.CLOUDINARY_FOLDER || 'forwarderly'}/ORD-${orden.correlativo}-${orden.anio}_${clientNameSanitized}`;

    const isCloudinaryConfigured = !!(
      process.env.CLOUDINARY_URL || 
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );

    if (isCloudinaryConfigured) {
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            resource_type: 'auto'
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result?.secure_url || '');
          }
        );
        Readable.from(req.file.buffer).pipe(stream);
      });
      fileUrl = await uploadPromise;
    } else {
      console.warn('Cloudinary not configured. Mocking file upload.');
      await new Promise(resolve => setTimeout(resolve, 800));
      const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
      fileUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1234567890/mock_${Date.now()}_${sanitizedName}`;
    }

    const updatedDoc = await prisma.ordenDocumento.update({
      where: { id: documentoId },
      data: {
        url: fileUrl,
        nombreArchivo: originalName,
        fechaSubida: new Date()
      },
      include: { tipoDocumento: true }
    });

    res.json(updatedDoc);
  } catch (error: any) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ message: 'Error al subir archivo: ' + error.message });
  }
});

// Clear document file from the requirement
router.delete('/:id/documentos/:documentoId/eliminar-archivo', authenticate, async (req: AuthRequest, res) => {
  const { id: ordenId, documentoId } = req.params;
  const { empresaId } = req.user!;

  try {
    const orden = await prisma.orden.findFirst({
      where: {
        id: ordenId,
        OR: [
          { cotizacion: { empresaId } },
          { cotizacionesAsociadas: { some: { empresaId } } }
        ]
      }
    });

    if (!orden) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }

    const docReq = await prisma.ordenDocumento.findUnique({
      where: { id: documentoId }
    });

    if (!docReq || docReq.ordenId !== ordenId) {
      return res.status(404).json({ message: 'Documento no encontrado' });
    }

    if (docReq.url) {
      await deleteFileFromCloudinary(docReq.url);
    }

    const updated = await prisma.ordenDocumento.update({
      where: { id: documentoId },
      data: {
        url: null,
        nombreArchivo: null,
        fechaSubida: null
      },
      include: { tipoDocumento: true }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar archivo: ' + error.message });
  }
});

export default router;
