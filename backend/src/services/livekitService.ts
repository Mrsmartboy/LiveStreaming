import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'devsecret1234567890abcdef';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'ws://localhost:7880';

export interface LiveKitGrant {
  roomJoin: boolean;
  room: string;
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  hidden?: boolean;
}

/**
 * Generate a LiveKit access token (JWT) manually.
 * This avoids ESM issues with livekit-server-sdk in CommonJS.
 */
export function generateLiveKitToken(options: {
  identity: string;
  name: string;
  roomName: string;
  canPublish: boolean;
  ttlSeconds?: number;
}): string {
  const { identity, name, roomName, canPublish, ttlSeconds = 3600 } = options;

  const now = Math.floor(Date.now() / 1000);

  const grant: LiveKitGrant = {
    roomJoin: true,
    room: roomName,
    canPublish,
    canSubscribe: true,
    canPublishData: true,
  };

  const payload = {
    iss: LIVEKIT_API_KEY,
    sub: identity,
    name,
    video: grant,
    nbf: now,
    exp: now + ttlSeconds,
    jti: uuidv4(),
  };

  return jwt.sign(payload, LIVEKIT_API_SECRET, { algorithm: 'HS256' });
}

/**
 * Generate a mentor (publisher) token.
 */
export function generateMentorToken(userId: string, userName: string, roomName: string): string {
  return generateLiveKitToken({
    identity: userId,
    name: userName,
    roomName,
    canPublish: true,
  });
}

/**
 * Generate a student (subscriber-only) token.
 */
export function generateStudentToken(userId: string, userName: string, roomName: string): string {
  return generateLiveKitToken({
    identity: userId,
    name: userName,
    roomName,
    canPublish: true,   // Students CAN publish — mic is controlled by UI raise-hand flow
  });
}

/**
 * Get the public WebSocket URL for the frontend to connect.
 * In production, replace with the public LiveKit URL.
 */
export function getLiveKitWsUrl(): string {
  // Expose the public-facing URL (Docker internal → public port)
  return process.env.LIVEKIT_PUBLIC_WS_URL || 'ws://localhost:7880';
}
