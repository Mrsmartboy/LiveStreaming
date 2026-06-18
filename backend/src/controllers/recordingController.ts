import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { listSessionRecordings, getDownloadUrl, getPublicUrl, s3 } from '../services/storageService';
import { PutObjectCommand } from '@aws-sdk/client-s3';

const MINIO_BUCKET = process.env.MINIO_BUCKET || 'recordings';

/**
 * GET /api/recordings/:sessionId
 * Lists all recordings for a session and returns presigned URLs.
 */
export async function getRecordings(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { id: true, title: true, recordingUrl: true, status: true, endedAt: true },
    });

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    // List files from MinIO
    const fileKeys = await listSessionRecordings(sessionId).catch(() => []);

    const recordings = await Promise.all(
      fileKeys.map(async (key) => ({
        key,
        publicUrl: getPublicUrl(key),
        downloadUrl: await getDownloadUrl(key, 3600),
        filename: key.split('/').pop() || key,
      }))
    );

    res.json({
      session,
      recordings,
      // Also include DB-stored recording URL if set
      primaryRecordingUrl: session.recordingUrl,
    });
  } catch (err) {
    console.error('Get recordings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * PUT /api/recordings/:sessionId/url
 * Manually set a recording URL for a session (e.g., after Egress completes).
 */
export async function setRecordingUrl(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { recordingUrl } = req.body as { recordingUrl: string };

  if (!recordingUrl) {
    res.status(400).json({ error: 'recordingUrl is required' });
    return;
  }

  try {
    const session = await prisma.session.update({
      where: { id: sessionId },
      data: { recordingUrl },
    });
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

/**
 * GET /api/recordings
 * List all sessions that have recordings (ENDED status with recordingUrl).
 */
export async function listAllRecordings(req: Request, res: Response): Promise<void> {
  try {
    const sessions = await prisma.session.findMany({
      where: { status: 'ENDED' },
      orderBy: { endedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        recordingUrl: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { attendance: true } },
      },
    });
    res.json(sessions);
  } catch (err) {
    console.error('List recordings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/recordings/:sessionId/upload
 * Receives a recorded .webm blob from the browser and stores it in MinIO.
 */
export async function uploadRecording(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  // multer puts file in req.file
  const file = (req as Request & { file?: Express.Multer.File }).file;
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  try {
    const key = `sessions/${sessionId}/${Date.now()}-recording.webm`;

    await s3.send(new PutObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype || 'audio/webm',
    }));

    const downloadUrl = await getDownloadUrl(key, 86400); // 24h link

    await prisma.session.update({
      where: { id: sessionId },
      data: { recordingUrl: downloadUrl },
    }).catch(() => { /* session may not exist or field missing */ });

    console.log(`✅ Recording uploaded for session ${sessionId}: ${key}`);
    res.json({ url: downloadUrl, key });
  } catch (err) {
    console.error('Upload recording error:', err);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
}
