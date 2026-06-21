import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppDispatch, useAppSelector } from '../store';
import { addQuestion, markQuestionAnswered } from '../store/slices/questionSlice';
import { Question } from '../store/slices/questionSlice';
import { addChatMessage } from '../store/slices/chatSlice';

// Connect to empty string = same host/port as the page was loaded from.
// Vite proxies /socket.io/* → http://backend:5000, so this works
// from any device on the network (not just localhost).
const SOCKET_URL = '';

export interface HandRaisedEvent {
  userId: string;
  userName: string;
  time: string;
}

export interface StudentJoinedEvent {
  userId: string;
  userName: string;
  time: string;
  onlineCount: number;
}

export interface StudentLeftEvent {
  userId: string;
  onlineCount: number;
}

interface UseSocketOptions {
  sessionId: string;
  onStudentJoined?: (event: StudentJoinedEvent) => void;
  onStudentLeft?: (event: StudentLeftEvent) => void;
  onMentorAnnouncement?: (message: string) => void;
  onHandRaised?: (event: HandRaisedEvent) => void;
  onHandLowered?: (userId: string) => void;
  onUnmuteApproved?: (userId: string) => void;
  onUnmuteDenied?: (userId: string) => void;
  onForceMuted?: (userId: string) => void;
  onSessionEnded?: () => void;
  onTranscript?: (entry: { userId: string; userName: string; text: string; isFinal: boolean; time: string }) => void;
}

export function useSocket({
  sessionId,
  onStudentJoined,
  onStudentLeft,
  onMentorAnnouncement,
  onHandRaised,
  onHandLowered,
  onUnmuteApproved,
  onUnmuteDenied,
  onForceMuted,
  onSessionEnded,
  onTranscript,
}: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const dispatch = useAppDispatch();
  const { token, user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    if (!token || !user) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-session', {
        sessionId,
        userId: user.id,
        userName: user.name,
      });
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });

    // Q&A
    socket.on('new-question', (question: Question) => dispatch(addQuestion(question)));
    socket.on('question-answered', ({ questionId }: { questionId: string }) => dispatch(markQuestionAnswered(questionId)));

    // Chat
    socket.on('new-chat-message', (message: any) => dispatch(addChatMessage(message)));

    // Presence
    socket.on('student-joined', (event: StudentJoinedEvent) => onStudentJoined?.(event));
    socket.on('student-left', (event: StudentLeftEvent) => onStudentLeft?.(event));
    socket.on('mentor-announcement', ({ message }: { message: string }) => onMentorAnnouncement?.(message));

    // Hand raise
    socket.on('hand-raised', (event: HandRaisedEvent) => onHandRaised?.(event));
    socket.on('hand-lowered', ({ userId }: { userId: string }) => onHandLowered?.(userId));

    // Unmute approval
    socket.on('unmute-approved', ({ userId }: { userId: string }) => onUnmuteApproved?.(userId));
    socket.on('unmute-denied', ({ userId }: { userId: string }) => onUnmuteDenied?.(userId));
    socket.on('force-muted', ({ userId }: { userId: string }) => onForceMuted?.(userId));

    // Session ended by mentor
    socket.on('session-ended', () => onSessionEnded?.());

    // Live transcript from others
    socket.on('transcript', (entry: { userId: string; userName: string; text: string; isFinal: boolean; time: string }) => {
      onTranscript?.(entry);
    });

    return () => {
      socket.emit('leave-session', { sessionId, userId: user.id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionId, token]);

  // ── Emit helpers ───────────────────────────────────────────────────────────
  const sendQuestion = useCallback((text: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('send-question', { sessionId, userId: user.id, text });
  }, [sessionId, user]);

  const answerQuestion = useCallback((questionId: string) => {
    socketRef.current?.emit('answer-question', { questionId, sessionId });
  }, [sessionId]);

  const sendAnnouncement = useCallback((message: string) => {
    socketRef.current?.emit('mentor-message', { sessionId, message });
  }, [sessionId]);

  const raiseHand = useCallback(() => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('raise-hand', { sessionId, userId: user.id, userName: user.name });
  }, [sessionId, user]);

  const lowerHand = useCallback(() => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('lower-hand', { sessionId, userId: user.id });
  }, [sessionId, user]);

  const approveUnmute = useCallback((userId: string) => {
    socketRef.current?.emit('approve-unmute', { sessionId, userId });
  }, [sessionId]);

  const denyUnmute = useCallback((userId: string) => {
    socketRef.current?.emit('deny-unmute', { sessionId, userId });
  }, [sessionId]);

  const forceMute = useCallback((userId: string) => {
    socketRef.current?.emit('force-mute', { sessionId, userId });
  }, [sessionId]);

  const sendTranscript = useCallback((text: string, isFinal: boolean, userId: string, userName: string) => {
    socketRef.current?.emit('transcript', { sessionId, userId, userName, text, isFinal });
  }, [sessionId]);

  const broadcastSessionEnd = useCallback(() => {
    socketRef.current?.emit('end-session', { sessionId });
  }, [sessionId]);

  const sendChatMessage = useCallback((text: string) => {
    if (!socketRef.current || !user) return;
    socketRef.current.emit('send-chat-message', { sessionId, text, userName: user.name });
  }, [sessionId, user]);

  return {
    sendQuestion,
    answerQuestion,
    sendAnnouncement,
    sendChatMessage,
    raiseHand,
    lowerHand,
    approveUnmute,
    denyUnmute,
    forceMute,
    sendTranscript,
    broadcastSessionEnd,
    socketRef,
  };
}
