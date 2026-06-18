import { Request } from 'express';

// ── Enums ──────────────────────────────────────────────────────────────────
export type Role = 'ADMIN' | 'MENTOR' | 'STUDENT';
export type SessionStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';

// ── JWT ────────────────────────────────────────────────────────────────────
export interface JWTPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

// ── Augmented Express Request ──────────────────────────────────────────────
export interface AuthRequest extends Request {
  user: JWTPayload;
}

// ── Prisma-shaped types (safe for API responses) ───────────────────────────
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

export interface SessionWithCounts {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: Date;
  startedAt: Date | null;
  endedAt: Date | null;
  livekitRoom: string;
  recordingUrl: string | null;
  status: SessionStatus;
  createdAt: Date;
  _count?: {
    attendance: number;
    questions: number;
  };
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  sessionId: string;
  joinedAt: Date;
  leftAt: Date | null;
  user: {
    name: string;
    email: string;
  };
}

export interface QuestionWithUser {
  id: string;
  text: string;
  answered: boolean;
  userId: string;
  sessionId: string;
  createdAt: Date;
  user: {
    name: string;
  };
}

// ── LiveKit Token payload ──────────────────────────────────────────────────
export interface LiveKitTokenPayload {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
}

// ── Socket Events ──────────────────────────────────────────────────────────
export interface JoinSessionPayload {
  sessionId: string;
  userId: string;
  userName: string;
}

export interface SendQuestionPayload {
  sessionId: string;
  userId: string;
  text: string;
}

export interface AnswerQuestionPayload {
  questionId: string;
  sessionId: string;
}

export interface LeaveSessionPayload {
  sessionId: string;
  userId: string;
}
