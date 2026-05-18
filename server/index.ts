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

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export { prisma };
