// @ts-nocheck
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

router.put('/:id', authenticate, async (req: AuthRequest, res) => {
  const { empresaId: userEmpresaId, rol: userRol } = req.user!;
  const { id } = req.params;
  const { nombres, apellidos, celular, correo, rol, estado, empresaId, password } = req.body;

  try {
    const existingUser = await prisma.usuario.findUnique({ where: { id } });
    if (!existingUser) return res.status(404).json({ message: 'Usuario no encontrado' });

    // Validate permissions
    if (userRol !== 'SUPER_ADMIN') {
      if (existingUser.empresaId !== userEmpresaId) {
        return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
      }
      if (rol === 'SUPER_ADMIN') {
        return res.status(403).json({ message: 'No puedes asignar el rol de Super Admin' });
      }
      if (existingUser.rol === 'SUPER_ADMIN') {
         return res.status(403).json({ message: 'No puedes editar un Super Admin' });
      }
    }

    const data: any = { nombres, apellidos, celular, correo, rol, estado };
    if (userRol === 'SUPER_ADMIN' && empresaId) {
       data.empresaId = empresaId;
    }
    
    if (password) {
      data.password = await bcrypt.hash(password, 10);
    }

    const updated = await prisma.usuario.update({
      where: { id },
      data
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

export default router;
