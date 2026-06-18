import { Router } from 'express';
import { listQuestions, markAnswered, deleteQuestion } from '../controllers/questionController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();

router.use(authMiddleware);

router.get('/session/:sessionId', listQuestions);
router.put('/:id/answer', requireRole('ADMIN', 'MENTOR'), markAnswered);
router.delete('/:id', requireRole('ADMIN', 'MENTOR'), deleteQuestion);

export default router;
