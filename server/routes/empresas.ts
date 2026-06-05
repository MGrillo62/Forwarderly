// File structure: I will implement each one as a skeleton to ensure imports work.
// empresas.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, authorize, AuthRequest } from '../middlewares/auth';

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

export default router;
