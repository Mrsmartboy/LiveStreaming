import { Router } from 'express';
import {
  listSessions,
  getSession,
  createSession,
  startSession,
  endSession,
  getSessionToken,
  getAttendance,
  deleteSession,
} from '../controllers/sessionController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { apiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// All session routes require authentication
router.use(authMiddleware);
router.use(apiRateLimiter);

router.get('/', listSessions);
router.post('/', requireRole('ADMIN', 'MENTOR'), createSession);

router.get('/:id', getSession);
router.delete('/:id', requireRole('ADMIN', 'MENTOR'), deleteSession);

router.put('/:id/start', requireRole('ADMIN', 'MENTOR'), startSession);
router.put('/:id/end', requireRole('ADMIN', 'MENTOR'), endSession);

router.get('/:id/token', getSessionToken);
router.get('/:id/attendance', requireRole('ADMIN', 'MENTOR'), getAttendance);

export default router;
