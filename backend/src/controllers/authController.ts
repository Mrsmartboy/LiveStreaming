import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';
import { JWTPayload, AuthRequest } from '../types';
import { blacklistToken } from '../services/redisService';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const JWT_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

// ── Validation Schemas ─────────────────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const createStudentSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

// ── Helpers ────────────────────────────────────────────────────────────────

function signToken(userId: string, role: string): string {
  return jwt.sign({ userId, role } as JWTPayload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

// ── Controllers ────────────────────────────────────────────────────────────

/** POST /api/auth/login */
export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = signToken(user.id, user.role);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/auth/logout */
export async function logout(req: Request, res: Response): Promise<void> {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    // Blacklist the token for 7 days (matching JWT expiry)
    await blacklistToken(token, 7 * 24 * 3600);
  }
  res.json({ message: 'Logged out successfully' });
}

/** POST /api/auth/create-student — MENTOR or ADMIN only */
export async function createStudent(req: Request, res: Response): Promise<void> {
  const parsed = createStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { name, email, password } = parsed.data;

  try {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword, role: 'STUDENT' },
    });

    res.status(201).json({
      message: 'Student account created successfully',
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    console.error('Create student error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/auth/me — current user profile */
export async function getMe(req: Request, res: Response): Promise<void> {
  const user = (req as AuthRequest).user;

  try {
    const profile = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!profile) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(profile);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/auth/students — list all students (MENTOR/ADMIN) */
export async function listStudents(req: Request, res: Response): Promise<void> {
  try {
    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        _count: { select: { attendance: true, questions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(students);
  } catch (err) {
    console.error('List students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/auth/students/:id — delete a student (ADMIN only) */
export async function deleteStudent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await prisma.user.delete({ where: { id, role: 'STUDENT' } });
    res.json({ message: 'Student deleted successfully' });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Student not found' });
      return;
    }
    console.error('Delete student error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
