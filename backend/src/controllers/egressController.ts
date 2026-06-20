import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import prisma from '../config/prisma';
import { AuthRequest } from '../types';
import { addTranscodeJob } from '../queue/transcodeQueue';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || '';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || '';
const LIVEKIT_HTTP_URL = process.env.LIVEKIT_HTTP_URL || 'https://mock-interview-98y90vi7.livekit.cloud';

/** Generate a short-lived Egress admin JWT */
function makeEgressToken(): string {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: LIVEKIT_API_KEY,
      sub: 'egress-service',
      nbf: now,
      exp: now + 120,
      video: { roomRecord: true },
    },
    LIVEKIT_API_SECRET,
    { algorithm: 'HS256' }
  );
}

/**
 * POST /api/recordings/:sessionId/start
 * Starts a LiveKit RoomCompositeEgress and saves the egressId to the session.
 */
export async function startRecording(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    if (session.recordingEgressId) { res.status(400).json({ error: 'Recording already in progress' }); return; }

    const token = makeEgressToken();

    // Start a RoomCompositeEgress — saves to LiveKit-managed S3 storage
    const response = await axios.post(
      `${LIVEKIT_HTTP_URL}/twirp/livekit.Egress/StartRoomCompositeEgress`,
      {
        room_name: session.livekitRoom,
        layout: 'speaker-dark',
        audio_only: false,
        file: {
          filepath: `recordings/${sessionId}/recording-${Date.now()}.mp4`,
          disable_manifest: false,
          s3: null,  // use LiveKit's built-in storage
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const egressId = response.data.egress_id;

    await prisma.session.update({
      where: { id: sessionId },
      data: { recordingEgressId: egressId },
    });

    console.log(`🔴 Recording started for session ${sessionId}, egressId: ${egressId}`);
    res.json({ egressId, status: 'recording' });
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error('Start recording error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to start recording', detail: e.response?.data });
  }
}

/**
 * POST /api/recordings/:sessionId/stop
 * Stops the active egress and saves the recording URL.
 */
export async function stopRecording(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) { res.status(404).json({ error: 'Session not found' }); return; }
    if (!session.recordingEgressId) { res.status(400).json({ error: 'No active recording' }); return; }

    const token = makeEgressToken();

    const response = await axios.post(
      `${LIVEKIT_HTTP_URL}/twirp/livekit.Egress/StopEgress`,
      { egress_id: session.recordingEgressId },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const fileResults = response.data?.file_results || [];
    const recordingUrl = fileResults[0]?.download_url || response.data?.download_url || null;

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        recordingEgressId: null,
        recordingUrl: recordingUrl,
      },
    });

    console.log(`⏹️ Recording stopped for session ${sessionId}, url: ${recordingUrl}`);
    
    if (recordingUrl) {
      // Extract the MinIO object key from the download URL or assume the key based on file path
      // Actually LiveKit Egress response has file_results[0].filename
      const filename = fileResults[0]?.filename;
      if (filename) {
        // Trigger HLS transcoding background job
        await addTranscodeJob(sessionId, filename);
      }
    }

    res.json({ status: 'stopped', recordingUrl });
  } catch (err: unknown) {
    const e = err as { response?: { data?: unknown }; message?: string };
    console.error('Stop recording error:', e.response?.data || e.message);
    res.status(500).json({ error: 'Failed to stop recording', detail: e.response?.data });
  }
}

// Re-export existing controllers
export { getRecordings, setRecordingUrl, listAllRecordings } from './recordingController';
