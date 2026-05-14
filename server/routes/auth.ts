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

export default router;
