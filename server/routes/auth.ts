import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await prisma.usuario.findUnique({
      where: { username },
      include: { empresa: true }
    });

    if (!user || user.estado === 'INACTIVO') {
      return res.status(401).json({ message: 'Credenciales inválidas o usuario inactivo' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id, rol: user.rol, empresaId: user.empresaId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        rol: user.rol,
        nombres: user.nombres,
        apellidos: user.apellidos,
        empresa: user.empresa
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

router.post('/register', async (req, res) => {
  const { nombres, apellidos, correo, celular, username, password, ruc, razonSocial } = req.body;

  if (!nombres || !apellidos || !correo || !username || !password || !ruc || !razonSocial) {
    return res.status(400).json({ message: 'Todos los campos son requeridos para completar el registro.' });
  }

  try {
    // 1. Check if user already exists
    const existingUser = await prisma.usuario.findFirst({
      where: {
        OR: [
          { username },
          { correo }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ message: 'El usuario o correo electrónico ya está registrado.' });
    }

    // 2. Check if company RUC already exists
    const existingEmpresa = await prisma.empresa.findUnique({
      where: { ruc }
    });

    if (existingEmpresa) {
      return res.status(400).json({ message: 'El RUC de la empresa ya se encuentra registrado.' });
    }

    // 3. Create both in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const empresa = await tx.empresa.create({
        data: {
          ruc,
          razonSocial,
          contacto: `${nombres} ${apellidos}`,
          celular: celular || '',
          correo,
          fechaInicio: new Date(),
          estado: 'ACTIVO',
          diasPrueba: 14, // 14-day trial
          montoSuscripcion: 155.00 // Default plan price
        }
      });

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await tx.usuario.create({
        data: {
          username,
          password: hashedPassword,
          nombres,
          apellidos,
          celular: celular || '',
          correo,
          rol: 'ADMIN', // The user who registers the company is the Admin
          empresaId: empresa.id,
          estado: 'ACTIVO'
        },
        include: { empresa: true }
      });

      return { empresa, user };
    });

    // 4. Generate JWT Token
    const token = jwt.sign(
      { id: result.user.id, rol: result.user.rol, empresaId: result.user.empresaId },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: result.user.id,
        username: result.user.username,
        rol: result.user.rol,
        nombres: result.user.nombres,
        apellidos: result.user.apellidos,
        empresa: result.user.empresa
      }
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    res.status(500).json({ message: 'Error interno del servidor durante el registro.' });
  }
});

export default router;
