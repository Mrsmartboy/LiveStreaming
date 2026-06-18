import { Router } from 'express';
import multer from 'multer';
import { getRecordings, setRecordingUrl, listAllRecordings, uploadRecording } from '../controllers/recordingController';
import { authMiddleware } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleMiddleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB

router.use(authMiddleware);

router.get('/', listAllRecordings);
router.get('/:sessionId', getRecordings);
router.put('/:sessionId/url', requireRole('ADMIN', 'MENTOR'), setRecordingUrl);
router.post('/:sessionId/upload', requireRole('ADMIN', 'MENTOR'), upload.single('recording'), uploadRecording);

export default router;
