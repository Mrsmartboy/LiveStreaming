import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { listSessionRecordings, getDownloadUrl, getPublicUrl, s3 } from '../services/storageService';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { addTranscodeJob } from '../queue/transcodeQueue';

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

    console.log(`📤 Uploading recording for session ${sessionId}: size=${file.buffer.length} bytes, mime=${file.mimetype}`);

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

    console.log(`✅ Recording uploaded for session ${sessionId}: ${key} (${file.buffer.length} bytes)`);

    // Trigger HLS transcoding background job
    await addTranscodeJob(sessionId, key);

    res.json({ url: downloadUrl, key });
  } catch (err) {
    console.error('Upload recording error:', err);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
}

/**
 * GET /api/recordings/:sessionId/transcode-progress
 * Fetches active HLS transcoding progress from BullMQ.
 */
export async function getTranscodeProgress(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const { transcodeQueue } = require('../queue/transcodeQueue');
    const jobs = await transcodeQueue.getJobs(['active', 'waiting', 'delayed']);
    console.log(`🔍 [Progress Check] SessionId: ${sessionId}, Total active/waiting/delayed jobs: ${jobs.length}`);
    for (const j of jobs) {
      const state = await j.getState();
      console.log(`   - Job ID: ${j.id}, SessionId in Job: ${j.data?.sessionId}, State: ${state}, Progress: ${JSON.stringify(j.progress)}`);
    }

    const sessionJob = jobs.find((j: any) => j.data?.sessionId === sessionId);
    console.log(`🔍 [Progress Check] sessionJob found: ${!!sessionJob}`);

    if (!sessionJob) {
      // Check if already completed recently (meaning no active job)
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        select: { hlsUrl: true },
      });

      if (session?.hlsUrl) {
        res.json({ status: 'completed', progress: 100 });
        return;
      }

      res.json({ status: 'not_found', progress: 0 });
      return;
    }

    const state = await sessionJob.getState();
    let rawProgress = sessionJob.progress;
    if (typeof rawProgress === 'string') {
      try {
        rawProgress = JSON.parse(rawProgress);
      } catch {
        rawProgress = null;
      }
    }

    let progressObj: any = { percent: 0, segments: 0, stage: 'waiting' };
    if (rawProgress && typeof rawProgress === 'object') {
      progressObj = {
        percent: typeof rawProgress.percent === 'number' ? rawProgress.percent : 0,
        segments: typeof rawProgress.segments === 'number' ? rawProgress.segments : 0,
        stage: rawProgress.stage || 'waiting',
        uploaded: rawProgress.uploaded,
        totalFiles: rawProgress.totalFiles,
      };
    } else if (typeof rawProgress === 'number') {
      progressObj.percent = rawProgress;
    }

    res.json({
      status: state,
      progress: progressObj.percent,
      segments: progressObj.segments,
      stage: progressObj.stage,
      uploaded: progressObj.uploaded,
      totalFiles: progressObj.totalFiles,
    });
  } catch (err) {
    console.error('Get transcode progress error:', err);
    res.status(500).json({ error: 'Failed to get progress' });
  }
}

