import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../types';

/** GET /api/sessions/:sessionId/questions */
export async function listQuestions(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const questions = await prisma.question.findMany({
      where: { sessionId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });
    res.json(questions);
  } catch (err) {
    console.error('List questions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** PUT /api/questions/:id/answer — mark as answered (MENTOR/ADMIN only) */
export async function markAnswered(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = (req as AuthRequest).user;

  try {
    const question = await prisma.question.update({
      where: { id },
      data: { answered: true },
      include: { user: { select: { name: true } } },
    });
    res.json(question);
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}

/** DELETE /api/questions/:id */
export async function deleteQuestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    await prisma.question.delete({ where: { id } });
    res.json({ message: 'Question deleted' });
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Question not found' });
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
}
