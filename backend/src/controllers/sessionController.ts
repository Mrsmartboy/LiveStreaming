import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import { AuthRequest } from '../types';
import { generateMentorToken, generateStudentToken, getLiveKitWsUrl } from '../services/livekitService';
import { cacheSession, getCachedSession, invalidateSession } from '../services/redisService';
import { deleteSessionFolder } from '../services/storageService';

// ── Validation ─────────────────────────────────────────────────────────────

const createSessionSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  scheduledAt: z.string().datetime(),
});

// ── Controllers ────────────────────────────────────────────────────────────

/** GET /api/sessions */
export async function listSessions(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await prisma.session.findMany({
      orderBy: { scheduledAt: 'desc' },
      include: {
        _count: { select: { attendance: true, questions: true } },
      },
    });
    res.json(sessions);
  } catch (err) {
    console.error('List sessions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/sessions/:id */
export async function getSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  // Check Redis cache first
  const cached = await getCachedSession<object>(id);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        _count: { select: { attendance: true, questions: true } },
      },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // Cache it
    await cacheSession(id, session);
    res.json(session);
  } catch (err) {
    console.error('Get session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** POST /api/sessions — MENTOR or ADMIN only */
export async function createSession(req: Request, res: Response): Promise<void> {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  const { title, description, scheduledAt } = parsed.data;

  try {
    const session = await prisma.session.create({
      data: {
        title,
        description,
        scheduledAt: new Date(scheduledAt),
        livekitRoom: `session-${uuidv4()}`,
        status: 'SCHEDULED',
      },
    });

    res.status(201).json(session);
  } catch (err) {
    console.error('Create session error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/sessions/:id/start — mark LIVE */
export async function startSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const session = await prisma.session.update({
      where: { id },
      data: { status: 'LIVE', startedAt: new Date() },
    });

    await invalidateSession(id);
    res.json(session);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/sessions/:id/end — mark ENDED */
export async function endSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const session = await prisma.session.update({
      where: { id },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    await invalidateSession(id);
    res.json(session);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/sessions/:id/token — get LiveKit join token */
export async function getSessionToken(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = (req as AuthRequest).user;

  try {
    const session = await prisma.session.findUnique({ where: { id } });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    if (session.status === 'ENDED') {
      res.status(400).json({ error: 'Session has already ended' });
      return;
    }

    // Get user name
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { name: true },
    });

    const userName = dbUser?.name || user.userId;
    const isMentor = user.role === 'MENTOR' || user.role === 'ADMIN';

    const token = isMentor
      ? generateMentorToken(user.userId, userName, session.livekitRoom)
      : generateStudentToken(user.userId, userName, session.livekitRoom);

    res.json({
      token,
      wsUrl: getLiveKitWsUrl(),
      roomName: session.livekitRoom,
      identity: user.userId,
    });
  } catch (err) {
    console.error('Get session token error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** GET /api/sessions/:id/attendance */
export async function getAttendance(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const records = await prisma.attendance.findMany({
      where: { sessionId: id },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    res.json(records);
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/sessions/:id */
export async function deleteSession(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    // Delete related video files and HLS segments from MinIO
    await deleteSessionFolder(id).catch((err) => {
      console.error(`Error deleting MinIO files for session ${id}:`, err);
    });

    await prisma.session.delete({ where: { id } });
    await invalidateSession(id);
    res.json({ message: 'Session deleted' });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Session not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
