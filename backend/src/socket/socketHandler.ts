import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../config/prisma';
import {
  addUserToRoom,
  removeUserFromRoom,
  getOnlineUsers,
} from '../services/redisService';
import {
  JWTPayload,
  JoinSessionPayload,
  SendQuestionPayload,
  AnswerQuestionPayload,
  LeaveSessionPayload,
} from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

export default function socketHandler(io: Server): void {
  // ── Auth Middleware ────────────────────────────────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.authorization?.split(' ')[1];

    if (!token) return next(new Error('Authentication required'));

    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const user = socket.user!;
    console.log(`🔌 Socket connected: ${socket.id} (${user.userId} / ${user.role})`);

    // ── Join Session ───────────────────────────────────────────────────────
    socket.on('join-session', async (payload: JoinSessionPayload) => {
      const { sessionId, userId, userName } = payload;
      try {
        socket.join(sessionId);
        await addUserToRoom(sessionId, userId);

        await prisma.attendance.upsert({
          where: { userId_sessionId: { userId, sessionId } },
          create: { userId, sessionId },
          update: { joinedAt: new Date(), leftAt: null },
        });

        const onlineUsers = await getOnlineUsers(sessionId);

        io.to(sessionId).emit('student-joined', {
          userId,
          userName,
          time: new Date().toISOString(),
          onlineCount: onlineUsers.length,
        });

        socket.emit('room-state', { onlineUsers, onlineCount: onlineUsers.length });
        console.log(`👋 ${userName} joined session ${sessionId}`);
      } catch (err) {
        console.error('join-session error:', err);
        socket.emit('error', { message: 'Failed to join session' });
      }
    });

    // ── Q&A ────────────────────────────────────────────────────────────────
    socket.on('send-question', async (payload: SendQuestionPayload) => {
      const { sessionId, userId, text } = payload;
      if (!text?.trim()) return;
      try {
        const question = await prisma.question.create({
          data: { text: text.trim(), userId, sessionId },
          include: { user: { select: { name: true } } },
        });
        io.to(sessionId).emit('new-question', question);
      } catch (err) {
        console.error('send-question error:', err);
        socket.emit('error', { message: 'Failed to send question' });
      }
    });

    socket.on('answer-question', async (payload: AnswerQuestionPayload) => {
      const { questionId, sessionId } = payload;
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      try {
        await prisma.question.update({ where: { id: questionId }, data: { answered: true } });
        io.to(sessionId).emit('question-answered', { questionId });
      } catch (err) {
        console.error('answer-question error:', err);
      }
    });

    // ── Raise Hand ─────────────────────────────────────────────────────────
    socket.on('raise-hand', ({ sessionId, userId, userName }: { sessionId: string; userId: string; userName: string }) => {
      console.log(`✋ Hand raised: ${userName} in ${sessionId}`);
      // Broadcast to everyone in room (mentor sees it in the panel)
      io.to(sessionId).emit('hand-raised', {
        userId,
        userName,
        time: new Date().toISOString(),
      });
    });

    socket.on('lower-hand', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      io.to(sessionId).emit('hand-lowered', { userId });
    });

    // ── Approve Unmute ─────────────────────────────────────────────────────
    socket.on('approve-unmute', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      console.log(`✅ Mentor approved unmute for ${userId}`);
      // Notify specific user they are approved
      io.to(sessionId).emit('unmute-approved', { userId });
      // Also remove hand from queue
      io.to(sessionId).emit('hand-lowered', { userId });
    });

    // ── Deny Unmute ────────────────────────────────────────────────────────
    socket.on('deny-unmute', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      io.to(sessionId).emit('unmute-denied', { userId });
      io.to(sessionId).emit('hand-lowered', { userId });
    });

    // ── Mute Student (Mentor force-mute) ───────────────────────────────────
    socket.on('force-mute', ({ sessionId, userId }: { sessionId: string; userId: string }) => {
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      console.log(`🔇 Force-muting ${userId} in ${sessionId}`);
      io.to(sessionId).emit('force-muted', { userId });
    });

    // ── End Session (Mentor broadcasts to all) ─────────────────────────────
    socket.on('end-session', ({ sessionId }: { sessionId: string }) => {
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      console.log(`🔴 Session ended by mentor: ${sessionId}`);
      io.to(sessionId).emit('session-ended', { sessionId });
    });

    // ── Mentor Announcement ────────────────────────────────────────────────
    socket.on('mentor-message', ({ sessionId, message }: { sessionId: string; message: string }) => {
      if (user.role !== 'MENTOR' && user.role !== 'ADMIN') return;
      io.to(sessionId).emit('mentor-announcement', { message, time: new Date().toISOString() });
    });

    // ── Live Chat ──────────────────────────────────────────────────────────
    socket.on('send-chat-message', ({ sessionId, text, userName }: { sessionId: string; text: string; userName: string }) => {
      if (!text?.trim()) return;
      const messagePayload = {
        id: uuidv4(),
        text: text.trim(),
        userId: user.userId,
        userName: userName || 'User',
        role: user.role,
        createdAt: new Date().toISOString(),
      };

      if (user.role === 'MENTOR' || user.role === 'ADMIN') {
        // Mentor messages go to everyone in the room
        io.to(sessionId).emit('new-chat-message', messagePayload);
      } else {
        // Student messages go ONLY to the sender and all Mentors/Admins in the room
        const roomSockets = io.sockets.adapter.rooms.get(sessionId);
        if (roomSockets) {
          for (const socketId of roomSockets) {
            const clientSocket = io.sockets.sockets.get(socketId) as AuthenticatedSocket;
            if (clientSocket) {
              const clientUser = clientSocket.user;
              if (
                clientSocket.id === socket.id ||
                clientUser?.role === 'MENTOR' ||
                clientUser?.role === 'ADMIN'
              ) {
                clientSocket.emit('new-chat-message', messagePayload);
              }
            }
          }
        }
      }
    });

    // ── Live Transcript ────────────────────────────────────────────────────
    socket.on('transcript', ({ sessionId, userId, userName, text, isFinal }: {
      sessionId: string; userId: string; userName: string; text: string; isFinal: boolean;
    }) => {
      // Broadcast transcript to everyone else in the room
      socket.to(sessionId).emit('transcript', { userId, userName, text, isFinal, time: new Date().toISOString() });
    });

    // ── Leave Session ──────────────────────────────────────────────────────
    socket.on('leave-session', async (payload: LeaveSessionPayload) => {
      const { sessionId, userId } = payload;
      try {
        socket.leave(sessionId);
        await removeUserFromRoom(sessionId, userId);
        await prisma.attendance.updateMany({
          where: { userId, sessionId, leftAt: null },
          data: { leftAt: new Date() },
        });
        const onlineUsers = await getOnlineUsers(sessionId);
        io.to(sessionId).emit('student-left', { userId, onlineCount: onlineUsers.length });
        // Remove any pending hands
        io.to(sessionId).emit('hand-lowered', { userId });
      } catch (err) {
        console.error('leave-session error:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Socket disconnected: ${socket.id}`);
    });
  });
}
