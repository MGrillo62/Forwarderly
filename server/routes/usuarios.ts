import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId, rol } = req.user!;
  if (rol === 'SUPER_ADMIN') {
    const usuarios = await prisma.usuario.findMany({ include: { empresa: true } });
    return res.json(usuarios);
  }
  const usuarios = await prisma.usuario.findMany({ where: { empresaId } });
  res.json(usuarios);
});

router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { empresaId: userEmpresaId, rol: userRol } = req.user!;
  const { username, password, nombres, apellidos, celular, correo, rol, empresaId } = req.body;

  if (rol === 'SUPER_ADMIN' && userRol !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'No puedes crear un Super Admin' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const targetEmpresaId = userRol === 'SUPER_ADMIN' ? empresaId : userEmpresaId;

  try {
    const usuario = await prisma.usuario.create({
      data: {
        username,
        password: hashedPassword,
        nombres,
        apellidos,
        celular,
        correo,
        rol,
        empresaId: targetEmpresaId
      }
    });
    res.json(usuario);
  } catch (error) {
    res.status(400).json({ message: 'Error al crear usuario. El username o correo ya existe.' });
  }
});

router.put('/me', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.user!;
  const { nombres, apellidos, celular, correo, password } = req.body;

  const data: any = { nombres, apellidos, celular, correo };
  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data
  });

  res.json(updated);
});

export default router;
