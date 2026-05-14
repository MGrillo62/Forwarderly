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

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/proveedores', proveedorRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/cotizaciones', cotizacionRoutes);
app.use('/api/ordenes', ordenRoutes);
app.use('/api/usuarios', usuarioRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { prisma };
