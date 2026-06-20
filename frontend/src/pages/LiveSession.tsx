import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConnectionState, Track, Participant, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { useAppSelector, useAppDispatch } from '../store';
import { endSession } from '../store/slices/sessionSlice';
import { useLiveKit } from '../hooks/useLiveKit';
import { useSocket } from '../hooks/useSocket';
import { useRecording } from '../hooks/useRecording';
import AttendanceList from '../components/AttendanceList';
import api from '../services/api';

// ── Small circular pip video ────────────────────────────────────────────────
function CircleVideo({
  participant,
  isLocal,
  label,
  className = '',
}: {
  participant: Participant | null;
  isLocal?: boolean;
  label?: string;
  className?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const isCamOn = participant?.isCameraEnabled;

  useEffect(() => {
    if (!participant || !videoRef.current) return;
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub?.track) pub.track.attach(videoRef.current);

    const handler = () => {
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.attach(videoRef.current);
    };
    participant.on('trackSubscribed', handler);
    // Also listen for local track publish events
    participant.on('localTrackPublished', handler);
    participant.on('trackPublished', handler);
    
    return () => {
      participant.off('trackSubscribed', handler);
      participant.off('localTrackPublished', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, isCamOn]);

  return (
    <div className={`relative rounded-full overflow-hidden border-2 border-indigo-500/60 shadow-xl shadow-indigo-500/20 ${className}`}>
      <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-cover" />
      {!isCamOn && (
        <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
          <span className="text-white font-bold text-lg">
            {(label || participant?.name || '?').charAt(0).toUpperCase()}
          </span>
        </div>
      )}
      {label && (
        <div className="absolute bottom-1 left-0 right-0 text-center">
          <span className="text-[10px] text-white/80 bg-black/50 px-1.5 rounded-full">{label}</span>
        </div>
      )}
    </div>
  );
}

// ── Draggable & Resizable Small circular pip video ──────────────────────────
function DraggableCircleVideo({
  participant,
  isLocal,
  label,
}: {
  participant: Participant | null;
  isLocal?: boolean;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [size, setSize] = useState(96); // default size: 96px
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const isCamOn = participant?.isCameraEnabled;

  useEffect(() => {
    if (!participant || !videoRef.current) return;
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub?.track) pub.track.attach(videoRef.current);

    const handler = () => {
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.attach(videoRef.current);
    };
    participant.on('trackSubscribed', handler);
    participant.on('localTrackPublished', handler);
    participant.on('trackPublished', handler);

    return () => {
      participant.off('trackSubscribed', handler);
      participant.off('localTrackPublished', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, isCamOn]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return;

    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX - position.x;
    const startY = e.clientY - position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = moveEvent.clientX - startX;
      const newY = moveEvent.clientY - startY;
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        width: `${size}px`,
        height: `${size}px`,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      className="absolute bottom-4 right-4 z-50 flex items-center justify-center transition-shadow duration-200"
    >
      {/* Video element container */}
      <div
        style={{ width: `${size}px`, height: `${size}px` }}
        className="w-full h-full relative rounded-full overflow-hidden border-2 border-indigo-500 shadow-2xl bg-slate-900"
      >
        <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-cover" />
        {!isCamOn && (
          <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {(label || participant?.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {label && (
          <div className="absolute bottom-1 left-0 right-0 text-center">
            <span className="text-[10px] text-white/80 bg-black/50 px-1.5 rounded-full">{label}</span>
          </div>
        )}
      </div>

      {/* Hover resize controls */}
      {showControls && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-800 text-xs px-2 py-1.5 rounded-lg flex items-center gap-2 shadow-xl backdrop-blur-sm pointer-events-auto"
        >
          <span className="text-slate-400">Size:</span>
          <input
            type="range"
            min="64"
            max="256"
            value={size}
            onChange={(e) => setSize(parseInt(e.target.value))}
            className="w-20 accent-indigo-500"
          />
        </div>
      )}
    </div>
  );
}

// ── Large main stage video ──────────────────────────────────────────────────
function MainVideo({
  participant,
  isLocal,
  label,
  useScreen = false,
}: {
  participant: Participant | null;
  isLocal?: boolean;
  label?: string;
  useScreen?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const isCamOn = useScreen
    ? !!participant?.getTrackPublication(Track.Source.ScreenShare)?.track
    : participant?.isCameraEnabled;

  useEffect(() => {
    if (!participant || !videoRef.current) return;
    const source = useScreen ? Track.Source.ScreenShare : Track.Source.Camera;
    const pub = participant.getTrackPublication(source);
    if (pub?.track) pub.track.attach(videoRef.current);

    const handler = () => {
      const p = participant.getTrackPublication(source);
      if (p?.track && videoRef.current) p.track.attach(videoRef.current);
    };
    participant.on('trackSubscribed', handler);
    participant.on('localTrackPublished', handler);
    participant.on('trackPublished', handler);

    return () => {
      participant.off('trackSubscribed', handler);
      participant.off('localTrackPublished', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(source);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, useScreen, isCamOn]);

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden">
      <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-contain" />
      {!isCamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/40 flex items-center justify-center mb-3">
            <span className="text-4xl font-bold text-indigo-400">
              {(label || participant?.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-slate-400 text-sm">{useScreen ? 'Screen share stopped' : 'Camera off'}</span>
        </div>
      )}
      {/* Label bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <span className="text-white text-sm font-medium flex items-center gap-2">
          {label || participant?.name}
          {isLocal && <span className="text-indigo-300 text-xs">(You)</span>}
        </span>
        {participant && (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${participant.isMicrophoneEnabled ? 'bg-emerald-500/30' : 'bg-red-500/30'}`}>
            {participant.isMicrophoneEnabled ? (
              <svg className="w-3 h-3 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
                <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
              </svg>
            ) : (
              <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Student tile for mentor grid ────────────────────────────────────────────
function StudentTile({
  participant,
  onForceMute,
}: {
  participant: RemoteParticipant;
  onForceMute?: (identity: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const isCamOn = participant.isCameraEnabled;

  useEffect(() => {
    if (!videoRef.current) return;
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub?.track) pub.track.attach(videoRef.current);
    const handler = () => {
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.attach(videoRef.current);
    };
    participant.on('trackSubscribed', handler);
    participant.on('trackPublished', handler);
    return () => {
      participant.off('trackSubscribed', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, isCamOn]);

  return (
    <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 aspect-video group">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
      {!participant.isCameraEnabled && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <span className="text-indigo-400 font-bold">{participant.name?.charAt(0).toUpperCase()}</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent flex items-center justify-between">
        <span className="text-white text-xs font-medium truncate max-w-[70%]">{participant.name || participant.identity}</span>
        <div className="flex items-center gap-1">
          {/* Mic status dot */}
          <span className={`w-1.5 h-1.5 rounded-full ${participant.isMicrophoneEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
          {/* Force mute button (mentor only) */}
          {participant.isMicrophoneEnabled && onForceMute && (
            <button
              onClick={() => onForceMute(participant.identity)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity"
              title="Force mute"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Raised Hand Queue (Mentor panel) ────────────────────────────────────────
function HandRaiseQueue({
  hands,
  onApprove,
  onDeny,
}: {
  hands: { userId: string; userName: string; time: string }[];
  onApprove: (userId: string) => void;
  onDeny: (userId: string) => void;
}) {
  if (hands.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-slate-500">
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19.5V12.75M10 12.75L7.5 15.25M10 12.75l2.5 2.5M14 19.5V12.75M14 12.75l-2.5 2.5M14 12.75l2.5 2.5M6 8.25V6a2.25 2.25 0 014.5 0v.75M18 8.25V6a2.25 2.25 0 00-4.5 0v.75M6 8.25h12" />
        </svg>
        <p className="text-xs">No raised hands</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {hands.map((h) => (
        <div key={h.userId} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2.5 animate-fade-in">
          <div className="flex items-center gap-2">
            <span className="text-lg">✋</span>
            <div>
              <p className="text-sm font-medium text-white">{h.userName}</p>
              <p className="text-xs text-slate-500">
                {new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onApprove(h.userId)}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-1 rounded-lg transition-all"
            >
              ✓ Allow
            </button>
            <button
              onClick={() => onDeny(h.userId)}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs px-2.5 py-1 rounded-lg transition-all"
            >
              ✗ Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main LiveSession Component ──────────────────────────────────────────────
export default function LiveSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const isMentor = user?.role === 'MENTOR' || user?.role === 'ADMIN';

  const [session, setSession] = useState<{ id: string; title: string; status: string } | null>(null);
  const [sidePanel, setSidePanel] = useState<'attendance' | 'hands'>('hands');
  const [onlineCount, setOnlineCount] = useState(0);
  const [notifications, setNotifications] = useState<{ id: number; text: string; type: 'info' | 'warn' | 'success' }[]>([]);
  const [connectError, setConnectError] = useState('');
  const [sessionEnding, setSessionEnding] = useState(false);

  // Hand raise state
  const [raisedHands, setRaisedHands] = useState<{ userId: string; userName: string; time: string }[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isUnmuted, setIsUnmuted] = useState(false); // student approved to speak

  // Recording
  const recording = useRecording({
    sessionId: sessionId || '',
    onUploadComplete: (url) => addNotif(url ? '✅ Recording saved to storage' : '✅ Recording downloaded', 'success'),
    onError: (msg) => addNotif(msg, 'warn'),
  });

  const notifId = useRef(0);

  const livekit = useLiveKit();
  const isConnected = livekit.connectionState === ConnectionState.Connected;

  // Helper to check if participant is mentor using role metadata
  const isParticipantMentor = (p: Participant | null) => {
    if (!p) return false;
    try {
      const meta = JSON.parse(p.metadata || '{}');
      return meta.role === 'MENTOR';
    } catch {
      return false;
    }
  };

  // Detect mentor participant
  const mentorParticipant = isMentor
    ? livekit.localParticipant
    : (livekit.remoteParticipants.find(p => isParticipantMentor(p)) ??
       livekit.remoteParticipants.find(p => p.name && p.name !== user?.name) ??
       livekit.remoteParticipants[0] ??
       null);

  const isScreenSharing = isMentor
    ? livekit.isScreenSharing
    : !!mentorParticipant?.getTrackPublication(Track.Source.ScreenShare)?.track;

  const addNotif = useCallback((text: string, type: 'info' | 'warn' | 'success' = 'info') => {
    const id = ++notifId.current;
    setNotifications(prev => [...prev, { id, text, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 4000);
  }, []);

  const socket = useSocket({
    sessionId: sessionId!,
    onStudentJoined: (e) => {
      setOnlineCount(e.onlineCount);
      addNotif(`${e.userName} joined`);
    },
    onStudentLeft: (e) => {
      setOnlineCount(e.onlineCount);
    },
    onMentorAnnouncement: (msg) => addNotif(`📢 ${msg}`, 'info'),
    onHandRaised: (e) => {
      if (isMentor) {
        setRaisedHands(prev => {
          if (prev.find(h => h.userId === e.userId)) return prev;
          return [...prev, e];
        });
        setSidePanel('hands');
        addNotif(`✋ ${e.userName} raised their hand`, 'warn');
      }
    },
    onHandLowered: (userId) => {
      setRaisedHands(prev => prev.filter(h => h.userId !== userId));
      // If it was this user lowering
      if (userId === user?.id) setIsHandRaised(false);
    },
    onUnmuteApproved: async (userId) => {
      if (userId === user?.id) {
        setIsUnmuted(true);
        setIsHandRaised(false);
        addNotif('✅ Mentor approved! You can now speak', 'success');
        await livekit.setMicEnabled(true); // explicitly enable, not toggle
      }
    },
    onUnmuteDenied: (userId) => {
      if (userId === user?.id) {
        setIsHandRaised(false);
        addNotif('Your request to speak was declined', 'warn');
      }
    },
    onForceMuted: async (userId) => {
      if (userId === user?.id) {
        setIsUnmuted(false);
        setIsHandRaised(false);
        await livekit.setMicEnabled(false); // explicitly disable, not toggle
        addNotif('You have been muted by the mentor', 'warn');
      }
    },
    onSessionEnded: async () => {
      // Received by ALL users (mentor + students) when mentor ends the session
      await livekit.disconnect();
      if (!isMentor) {
        addNotif('The session has ended', 'warn');
        setTimeout(() => navigate('/student'), 1500);
      }
    },
  });

  // Init session
  useEffect(() => {
    if (!sessionId) return;
    const init = async () => {
      try {
        const { data: sessionData } = await api.get(`/sessions/${sessionId}`);
        setSession(sessionData);
        if (sessionData.status === 'ENDED') { setConnectError('This session has ended'); return; }

        const { data: tokenData } = await api.get(`/sessions/${sessionId}/token`);
        await livekit.connect(tokenData.wsUrl, tokenData.token, isMentor);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string } } };
        setConnectError(e.response?.data?.error || 'Failed to join session');
      }
    };
    init();
    return () => { livekit.disconnect(); };
  }, [sessionId]);

  const handleRaiseHand = () => {
    if (isHandRaised) {
      setIsHandRaised(false);
      socket.lowerHand();
    } else {
      setIsHandRaised(true);
      socket.raiseHand();
      addNotif('✋ Hand raised — waiting for mentor approval');
    }
  };

  const handleStudentMuteToggle = async () => {
    if (!isUnmuted) {
      addNotif('Raise your hand to request to speak', 'warn');
      return;
    }
    await livekit.toggleMic();
  };

  const handleForceMute = useCallback((userId: string) => {
    socket.forceMute(userId);
  }, [socket]);

  const handleEndSession = async () => {
    if (!sessionId || !confirm('End this session for everyone?')) return;
    setSessionEnding(true);
    try {
      const { endSession } = await import('../store/slices/sessionSlice');
      await dispatch(endSession(sessionId)).unwrap();
      socket.broadcastSessionEnd(); // notify all students in real-time
      await livekit.disconnect();
      navigate('/mentor');
    } catch { setSessionEnding(false); }
  };

  const handleLeave = async () => {
    await livekit.disconnect();
    navigate(isMentor ? '/mentor' : '/student');
  };

  if (connectError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Cannot Join Session</h2>
          <p className="text-slate-400 mb-6">{connectError}</p>
          <button onClick={() => navigate(-1)} className="btn-brand">Go Back</button>
        </div>
      </div>
    );
  }

  const connLabel: Record<ConnectionState, string> = {
    [ConnectionState.Connecting]: 'Connecting...',
    [ConnectionState.Connected]: 'Connected',
    [ConnectionState.Reconnecting]: 'Reconnecting...',
    [ConnectionState.Disconnected]: 'Disconnected',
    [ConnectionState.SignalReconnecting]: 'Reconnecting...',
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/90 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={handleLeave} className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-white font-semibold text-sm truncate">{session?.title}</h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                {connLabel[livekit.connectionState]}
              </span>
              {isConnected && <span className="text-slate-500 text-xs">· {onlineCount} online</span>}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {isMentor ? (
            <>
              {/* Mic */}
              <button onClick={livekit.toggleMic} title={livekit.isMicEnabled ? 'Mute' : 'Unmute'}
                className={`p-2 rounded-xl border transition-all ${livekit.isMicEnabled ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
                <MicIcon muted={!livekit.isMicEnabled} />
              </button>
              {/* Camera */}
              <button onClick={livekit.toggleCamera} title={livekit.isCameraEnabled ? 'Stop Camera' : 'Start Camera'}
                className={`p-2 rounded-xl border transition-all ${livekit.isCameraEnabled ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
                <CamIcon off={!livekit.isCameraEnabled} />
              </button>
              {/* Screen share */}
              <button onClick={livekit.toggleScreenShare} title="Screen Share"
                className={`p-2 rounded-xl border transition-all hidden sm:flex ${livekit.isScreenSharing ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                <ScreenIcon />
              </button>
              {/* Record */}
              <button
                onClick={() => recording.isRecording ? recording.stop() : recording.start()}
                disabled={recording.isUploading}
                title={recording.isRecording ? 'Stop Recording' : 'Start Recording'}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all hidden sm:flex ${
                  recording.isRecording
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40'
                }`}>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recording.isRecording ? 'bg-red-500' : 'bg-slate-500'}`} />
                <span>{recording.isUploading ? 'Saving...' : recording.isRecording ? 'Stop REC' : 'REC'}</span>
              </button>
              {/* End session */}
              <button onClick={handleEndSession} disabled={sessionEnding}
                className="flex items-center gap-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-xs font-semibold px-3 py-2 rounded-xl transition-all">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                <span className="hidden sm:inline">End</span>
              </button>
            </>
          ) : (
            <>
              {/* Student: raise hand */}
              <button onClick={handleRaiseHand}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
                  isHandRaised
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 animate-pulse'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/40 hover:text-amber-400'
                }`}>
                <span className="text-base">✋</span>
                <span className="hidden sm:inline">{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>
              </button>
              {/* Student: mic (only if approved) */}
              <button onClick={handleStudentMuteToggle}
                className={`p-2 rounded-xl border transition-all ${
                  !isUnmuted
                    ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed'
                    : livekit.isMicEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                      : 'bg-red-500/20 border-red-500/40 text-red-400'
                }`}
                title={!isUnmuted ? 'Raise hand to speak' : livekit.isMicEnabled ? 'Mute' : 'Unmute'}>
                <MicIcon muted={!livekit.isMicEnabled || !isUnmuted} />
              </button>
              {/* Student: camera */}
              <button onClick={livekit.toggleCamera} title={livekit.isCameraEnabled ? 'Stop Camera' : 'Start Camera'}
                className={`p-2 rounded-xl border transition-all ${livekit.isCameraEnabled ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-red-500/20 border-red-500/40 text-red-400'}`}>
                <CamIcon off={!livekit.isCameraEnabled} />
              </button>
              {/* Leave */}
              <button onClick={handleLeave} className="text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-all">
                Leave
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex">
        {/* Video Area */}
        <div className="flex-1 relative overflow-hidden p-3">
          {!isConnected ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">{connLabel[livekit.connectionState]}</p>
              </div>
            </div>
          ) : isMentor ? (
            /* ─── MENTOR LAYOUT ─────────────────────────────────────────── */
            <MentorLayout
              localParticipant={livekit.localParticipant}
              remoteParticipants={livekit.remoteParticipants}
              isScreenSharing={livekit.isScreenSharing}
              onForceMute={handleForceMute}
            />
          ) : (
            /* ─── STUDENT LAYOUT ────────────────────────────────────────── */
            <StudentLayout
              localParticipant={livekit.localParticipant}
              mentorParticipant={mentorParticipant as RemoteParticipant | null}
              isScreenSharing={isScreenSharing}
              userName={user?.name || 'You'}
            />
          )}
        </div>

        {/* Side Panel */}
        <div className="w-72 flex-shrink-0 border-l border-slate-800 flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 flex-shrink-0">
            {isMentor && (
              <TabButton active={sidePanel === 'hands'} onClick={() => setSidePanel('hands')}>
                Hands {raisedHands.length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {raisedHands.length}
                  </span>
                )}
              </TabButton>
            )}
            {isMentor && (
              <TabButton active={sidePanel === 'attendance'} onClick={() => setSidePanel('attendance')}>
                People
              </TabButton>
            )}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-hidden">
            {sidePanel === 'hands' && isMentor && (
              <HandRaiseQueue
                hands={raisedHands}
                onApprove={socket.approveUnmute}
                onDeny={socket.denyUnmute}
              />
            )}
            {sidePanel === 'attendance' && isMentor && (
              <AttendanceList
                sessionId={sessionId!}
                onlineCount={onlineCount}
                remoteParticipants={livekit.remoteParticipants}
                onForceMute={socket.forceMute}
                onApproveUnmute={socket.approveUnmute}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Toast Notifications ──────────────────────────────────────────── */}
      <div className="fixed bottom-4 left-4 space-y-2 z-50 pointer-events-none max-w-xs">
        {notifications.map((n) => (
          <div key={n.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm shadow-xl animate-slide-in-right backdrop-blur-sm ${
              n.type === 'success' ? 'bg-emerald-900/80 border border-emerald-500/40 text-emerald-200' :
              n.type === 'warn'    ? 'bg-amber-900/80 border border-amber-500/40 text-amber-200' :
                                    'bg-slate-800/90 border border-slate-700/60 text-slate-200'
            }`}>
            {n.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mentor Layout Component ─────────────────────────────────────────────────
function MentorLayout({
  localParticipant,
  remoteParticipants,
  isScreenSharing,
  onForceMute,
}: {
  localParticipant: LocalParticipant | null;
  remoteParticipants: RemoteParticipant[];
  isScreenSharing: boolean;
  onForceMute: (id: string) => void;
}) {
  return (
    <div className="relative w-full h-full">
      {/* Main area: screen share or student grid */}
      {isScreenSharing ? (
        // Screen share is main stage
        <div className="w-full h-full">
          {localParticipant && <MainVideo participant={localParticipant} isLocal useScreen label="Your Screen" />}
        </div>
      ) : (
        // Student grid
        <div className="w-full h-full overflow-y-auto">
          {remoteParticipants.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <svg className="w-12 h-12 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">Waiting for students to join...</p>
            </div>
          ) : (
            <div className={`grid gap-3 h-full content-start ${
              remoteParticipants.length === 1 ? 'grid-cols-1' :
              remoteParticipants.length <= 4 ? 'grid-cols-2' :
              'grid-cols-3'
            }`}>
              {remoteParticipants.map(p => (
                <StudentTile key={p.sid} participant={p} onForceMute={onForceMute} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mentor self-cam: draggable & resizable circle */}
      {localParticipant && (
        <DraggableCircleVideo
          participant={localParticipant}
          isLocal
          label="You"
        />
      )}
    </div>
  );
}

// ── Student Layout Component ────────────────────────────────────────────────
function StudentLayout({
  localParticipant,
  mentorParticipant,
  isScreenSharing,
  userName,
}: {
  localParticipant: LocalParticipant | null;
  mentorParticipant: RemoteParticipant | null;
  isScreenSharing: boolean;
  userName: string;
}) {
  return (
    <div className="relative w-full h-full">
      {/* Main stage: mentor camera or screen share */}
      <div className="w-full h-full">
        {mentorParticipant ? (
          <MainVideo
            participant={mentorParticipant}
            useScreen={isScreenSharing}
            label={isScreenSharing ? 'Mentor Screen' : (mentorParticipant.name || 'Mentor')}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
              <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-sm">Waiting for mentor to start broadcasting...</p>
          </div>
        )}
      </div>

      {/* If screen sharing AND mentor cam is available, show mentor cam as extra PiP at bottom-right */}
      {isScreenSharing && mentorParticipant && mentorParticipant.isCameraEnabled && (
        <div className="absolute bottom-4 right-4 z-20">
          <CircleVideo
            participant={mentorParticipant}
            label={mentorParticipant.name || 'Mentor'}
            className="w-20 h-20 shadow-2xl ring-2 ring-violet-500/50"
          />
        </div>
      )}

      {/* Student self-cam: small circle, bottom-left (if screen sharing and mentor cam is in bottom-right) or bottom-right (otherwise) */}
      {localParticipant && (
        <div className={`absolute z-20 ${
          isScreenSharing && mentorParticipant && mentorParticipant.isCameraEnabled
            ? 'bottom-4 left-4'
            : 'bottom-4 right-4'
        }`}>
          <CircleVideo
            participant={localParticipant}
            isLocal
            label="You"
            className="w-16 h-16 shadow-2xl ring-2 ring-indigo-500/40"
          />
        </div>
      )}
    </div>
  );
}

// ── Small utility components ────────────────────────────────────────────────
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
        active ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300'
      }`}>
      {children}
    </button>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return off ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
