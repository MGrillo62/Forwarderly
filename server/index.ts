import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/auth';
import empresaRoutes from './routes/empresas';
import clienteRoutes from './routes/clientes';
import proveedorRoutes from './routes/proveedores';
import categoriaRoutes from './routes/categorias';
import cotizacionRoutes from './routes/cotizaciones';
import ordenRoutes from './routes/ordenes';
import usuarioRoutes from './routes/usuarios';
import costeoRoutes from './routes/costeos';
import leadsRoutes from './routes/leads';
import dashboardRoutes from './routes/dashboards';
import girosNegocioRoutes from './routes/girosNegocio';
import bancosRoutes from './routes/bancos';
import suscripcionesRoutes from './routes/suscripciones';
import reclamacionesRoutes from './routes/reclamaciones';
import tiposDocumentoRoutes from './routes/tiposDocumento';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Configuración de CORS más explícita
app.use(cors({
  origin: '*', // Permite todos los orígenes para pruebas
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-empresa-id']
}));

app.use(express.json());

// Ruta de prueba para verificar que el servidor está vivo
app.get('/', (req, res) => {
  res.send('Forwarderly API is running...');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/ordenes', ordenRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/costeos', costeoRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/giros-negocio', girosNegocioRoutes);
app.use('/api/bancos', bancosRoutes);
app.use('/api/suscripciones', suscripcionesRoutes);
app.use('/api/reclamaciones', reclamacionesRoutes);
app.use('/api/tipos-documento', tiposDocumentoRoutes);

// Self-healing function to ensure custom document tables exist in the runtime database
async function ensureTablesExist() {
  console.log('Verificando/creando tablas de documentos en la base de datos de producción...');
  try {
    // 1. Create TipoDocumento table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "TipoDocumento" (
        "id" TEXT NOT NULL,
        "nombre" TEXT NOT NULL,
        "empresaId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TipoDocumento_pkey" PRIMARY KEY ("id")
      );
    `);

    // 2. Create OrdenDocumento table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrdenDocumento" (
        "id" TEXT NOT NULL,
        "ordenId" TEXT NOT NULL,
        "tipoDocumentoId" TEXT NOT NULL,
        "url" TEXT,
        "nombreArchivo" TEXT,
        "fechaSubida" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "OrdenDocumento_pkey" PRIMARY KEY ("id")
      );
    `);

    // 3. Create unique index for TipoDocumento
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "TipoDocumento_nombre_empresaId_key" ON "TipoDocumento"("nombre", "empresaId");
      `);
    } catch (e) {}

    // 4. Create unique index for OrdenDocumento
    try {
      await prisma.$executeRawUnsafe(`
        CREATE UNIQUE INDEX "OrdenDocumento_ordenId_tipoDocumentoId_key" ON "OrdenDocumento"("ordenId", "tipoDocumentoId");
      `);
    } catch (e) {}

    // 5. Add Foreign Key constraints
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "TipoDocumento" 
        ADD CONSTRAINT "TipoDocumento_empresaId_fkey" 
        FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") 
        ON DELETE RESTRICT ON UPDATE CASCADE;
      `);
    } catch (e) {}

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "OrdenDocumento" 
        ADD CONSTRAINT "OrdenDocumento_ordenId_fkey" 
        FOREIGN KEY ("ordenId") REFERENCES "Orden"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (e) {}

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "OrdenDocumento" 
        ADD CONSTRAINT "OrdenDocumento_tipoDocumentoId_fkey" 
        FOREIGN KEY ("tipoDocumentoId") REFERENCES "TipoDocumento"("id") 
        ON DELETE CASCADE ON UPDATE CASCADE;
      `);
    } catch (e) {}

    console.log('Tablas de documentos verificadas con éxito.');
  } catch (error) {
    console.error('Error al asegurar la existencia de tablas de documentos:', error);
  }
}

const PORT = process.env.PORT || 5000;

ensureTablesExist().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});

export { prisma };
