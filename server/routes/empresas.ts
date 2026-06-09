// File structure: I will implement each one as a skeleton to ensure imports work.
// empresas.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';
import multer from 'multer';
import { deleteFileFromCloudinary } from '../utils/cloudinaryHelper';
import { cloudinary } from '../utils/cloudinary';
import { Readable } from 'stream';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const empresas = await prisma.empresa.findMany();
  res.json(empresas);
});

router.post('/', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  const empresa = await prisma.empresa.create({ data: req.body });
  res.json(empresa);
});

router.get('/mi-empresa', authenticate, async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    if (!empresaId) {
      return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });
    }
    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    });
    res.json(empresa);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al obtener empresa: ' + error.message });
  }
});

router.put('/:id', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {

  const id = req.params.id as string;
  const empresa = await prisma.empresa.update({
    where: { id },
    data: req.body
  });
  res.json(empresa);
});

router.delete('/:id', authenticate, authorize(['SUPER_ADMIN']), async (req, res) => {
  try {
    const id = req.params.id as string;
    const empresa = await prisma.empresa.findUnique({ where: { id } });
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa no encontrada' });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Find all related cotizaciones and costeos for this company
      const cotizaciones = await tx.cotizacion.findMany({ where: { empresaId: id } });
      const cotizacionIds = cotizaciones.map(c => c.id);
      
      const costeos = await tx.costeoImportacion.findMany({ where: { empresaId: id } });
      const costeoIds = costeos.map(c => c.id);

      // 2. Find and delete related orders and payments
      const ordenes = await tx.orden.findMany({ where: { cotizacionId: { in: cotizacionIds } } });
      const ordenIds = ordenes.map(o => o.id);
      
      await tx.cobro.deleteMany({ where: { ordenId: { in: ordenIds } } });
      await tx.ordenPago.deleteMany({ where: { ordenId: { in: ordenIds } } });
      await tx.ordenEstadoHistorial.deleteMany({ where: { ordenId: { in: ordenIds } } });
      await tx.orden.deleteMany({ where: { id: { in: ordenIds } } });

      // 3. Delete Costeo items and Costeos
      await tx.costeoImportacionItem.deleteMany({ where: { costeoId: { in: costeoIds } } });
      await tx.costeoImportacion.deleteMany({ where: { empresaId: id } });

      // 4. Delete Cotizacion details and Cotizaciones
      await tx.cotizacionEstadoHistorial.deleteMany({ where: { cotizacionId: { in: cotizacionIds } } });
      await tx.cotizacionLinea.deleteMany({ where: { cotizacionId: { in: cotizacionIds } } });
      await tx.cotizacion.deleteMany({ where: { empresaId: id } });

      // 5. Delete categories and concepts
      const categorias = await tx.categoria.findMany({ where: { empresaId: id } });
      const categoriaIds = categorias.map(c => c.id);
      await tx.concepto.deleteMany({ where: { categoriaId: { in: categoriaIds } } });
      await tx.categoria.deleteMany({ where: { empresaId: id } });

      // 6. Delete other company-owned entities
      await tx.lead.deleteMany({ where: { empresaId: id } });
      await tx.cliente.deleteMany({ where: { empresaId: id } });
      await tx.proveedor.deleteMany({ where: { empresaId: id } });
      await tx.giroNegocio.deleteMany({ where: { empresaId: id } });
      await tx.banco.deleteMany({ where: { empresaId: id } });
      await tx.pagoSuscripcion.deleteMany({ where: { empresaId: id } });
      await tx.usuario.deleteMany({ where: { empresaId: id } });

      // 7. Finally delete the company
      await tx.empresa.delete({ where: { id } });
    });

    res.json({ success: true, message: 'Empresa y todos sus datos relacionados eliminados con éxito' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar la empresa: ' + error.message });
  }
});

// Configure multer for logo uploads
const upload = multer({ storage: multer.memoryStorage() });

// Upload company logo
router.post('/mi-empresa/logo', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), upload.single('logo'), async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    if (!empresaId) {
      return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Debe adjuntar una imagen para el logo' });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    });

    if (empresa && empresa.logoUrl) {
      await deleteFileFromCloudinary(empresa.logoUrl);
    }

    const isCloudinaryConfigured = !!(
      process.env.CLOUDINARY_URL || 
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );

    let logoUrl = '';
    if (isCloudinaryConfigured) {
      const uploadPromise = new Promise<string>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${process.env.CLOUDINARY_FOLDER || 'forwarderly'}/logos`,
            resource_type: 'image',
            transformation: [{ width: 250, height: 100, crop: 'limit' }]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result?.secure_url || '');
          }
        );
        Readable.from(req.file.buffer).pipe(stream);
      });
      logoUrl = await uploadPromise;
    } else {
      console.warn('Cloudinary not configured. Mocking logo upload.');
      await new Promise(resolve => setTimeout(resolve, 800));
      logoUrl = `https://res.cloudinary.com/mock-cloud/image/upload/v1234567890/mock_logo_${Date.now()}.png`;
    }

    const updated = await prisma.empresa.update({
      where: { id: empresaId },
      data: { logoUrl }
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error al subir logo:', error);
    res.status(500).json({ message: 'Error al subir el logo: ' + error.message });
  }
});

// Remove company logo
router.delete('/mi-empresa/logo', authenticate, authorize(['SUPER_ADMIN', 'ADMIN']), async (req: AuthRequest, res) => {
  try {
    const { empresaId } = req.user!;
    if (!empresaId) {
      return res.status(400).json({ message: 'Usuario no pertenece a una empresa' });
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId }
    });

    if (empresa && empresa.logoUrl) {
      await deleteFileFromCloudinary(empresa.logoUrl);
    }

    const updated = await prisma.empresa.update({
      where: { id: empresaId },
      data: { logoUrl: null }
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: 'Error al eliminar logo: ' + error.message });
  }
});

export default router;
