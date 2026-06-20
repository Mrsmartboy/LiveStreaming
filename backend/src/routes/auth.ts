import { Router } from 'express';
import { login, logout, createStudent, getMe, listStudents, deleteStudent, createMentor, listMentors, deleteMentor } from '../controllers/authController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Public
router.post('/login', authRateLimiter, login);

// Authenticated
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, getMe);

// Mentor / Admin only
router.post('/create-student', authMiddleware, requireRole('ADMIN', 'MENTOR'), createStudent);
router.get('/students', authMiddleware, requireRole('ADMIN', 'MENTOR'), listStudents);
router.delete('/students/:id', authMiddleware, requireRole('ADMIN'), deleteStudent);

// Mentor management (Admin only)
router.post('/create-mentor', authMiddleware, requireRole('ADMIN'), createMentor);
router.get('/mentors', authMiddleware, requireRole('ADMIN'), listMentors);
router.delete('/mentors/:id', authMiddleware, requireRole('ADMIN'), deleteMentor);

export default router;
