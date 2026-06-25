import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConnectionState, Track, Participant, RemoteParticipant, LocalParticipant } from 'livekit-client';
import { useAppSelector, useAppDispatch } from '../store';
import { endSession } from '../store/slices/sessionSlice';
import { useLiveKit } from '../hooks/useLiveKit';
import { useSocket } from '../hooks/useSocket';
import { useRecording } from '../hooks/useRecording';
import AttendanceList from '../components/AttendanceList';
import ChatPanel from '../components/ChatPanel';
import { clearChatMessages } from '../store/slices/chatSlice';
import api from '../services/api';

// ── SVG Icon Components ──────────────────────────────────────────────────────
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function LayoutGridIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

// Presentation layout icon
function SpeakerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function HangupIcon() {
  return (
    <svg className="w-5 h-5 transform rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function HandsIcon() {
  return (
    <span className="text-lg leading-none">✋</span>
  );
}

function MicIcon({ muted }: { muted: boolean }) {
  return muted ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function CamIcon({ off }: { off: boolean }) {
  return off ? (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function SparklesIcon({ active }: { active: boolean }) {
  return (
    <svg className={`w-5 h-5 transition-colors ${active ? 'text-emerald-400' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
}

// ── Participant Tile Component ──────────────────────────────────────────────
function ParticipantTile({
  participant,
  isLocal,
  isMentorTile,
  onForceMute,
  isCompact = false,
  fillHeight = false,
}: {
  participant: Participant;
  isLocal?: boolean;
  isMentorTile?: boolean;
  onForceMute?: (identity: string) => void;
  isCompact?: boolean;
  fillHeight?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isCamOn = participant.isCameraEnabled;
  const isMicOn = participant.isMicrophoneEnabled;
  const [speaking, setSpeaking] = useState(participant.isSpeaking);

  useEffect(() => {
    const handleSpeaking = () => {
      setSpeaking(participant.isSpeaking);
    };
    participant.on('isSpeakingChanged', handleSpeaking);
    return () => {
      participant.off('isSpeakingChanged', handleSpeaking);
    };
  }, [participant]);

  useEffect(() => {
    if (!videoRef.current) return;

    const attachActiveTrack = () => {
      const pub = participant.getTrackPublication(Track.Source.Camera);
      if (pub?.track && videoRef.current) {
        pub.track.attach(videoRef.current);
        return true;
      }
      return false;
    };

    const attached = attachActiveTrack();
    let intervalId: any;
    if (!attached && isCamOn) {
      intervalId = setInterval(() => {
        if (attachActiveTrack()) {
          clearInterval(intervalId);
        }
      }, 100);
    }

    const handler = () => {
      attachActiveTrack();
    };

    participant.on('trackSubscribed', handler);
    participant.on('localTrackPublished', handler);
    participant.on('trackPublished', handler);

    return () => {
      if (intervalId) clearInterval(intervalId);
      participant.off('trackSubscribed', handler);
      participant.off('localTrackPublished', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(Track.Source.Camera);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, isCamOn]);

  return (
    <div className={`relative rounded-2xl overflow-hidden bg-slate-900 border transition-all duration-300 ${fillHeight ? 'w-full h-full' : 'aspect-video'} shadow-lg group ${speaking ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-emerald-500/10' : 'border-slate-800 hover:border-slate-700'
      }`}>
      <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-cover" />

      {!isCamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className={`${isCompact ? 'w-8 h-8 md:w-10 md:h-10' : 'w-16 h-16 md:w-20 md:h-20'} rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-lg transition-transform duration-300 group-hover:scale-105`}>
            <span className={`${isCompact ? 'text-xs md:text-sm' : 'text-2xl md:text-3xl'} font-bold text-indigo-300`}>
              {(participant.name || participant.identity || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Top Left: Compact Microphone status icon */}
      <div className={`absolute top-1.5 left-1.5 z-10 flex items-center justify-center bg-black/60 backdrop-blur-md ${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full border border-white/10 shadow-md`}>
        {isMicOn ? (
          <svg className={`text-emerald-400 ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} viewBox="0 0 20 20" fill="currentColor">
            <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
            <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
          </svg>
        ) : (
          <svg className={`text-red-400 ${isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        )}
      </div>

      {/* Bottom Left: Unified compact name & role overlay */}
      <div className={`absolute ${isCompact ? 'bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-lg' : 'bottom-2.5 left-2.5 px-2.5 py-1 rounded-xl'} z-10 bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-1 shadow-md max-w-[calc(100%-20px)]`}>
        <span className={`text-white font-medium truncate ${isCompact ? 'text-[9px]' : 'text-[11px]'}`}>
          {participant.name || participant.identity}
          {isMentorTile && <span className="text-indigo-300 font-semibold ml-1 text-[8px] uppercase tracking-wider whitespace-nowrap">(Mentor)</span>}
          {isLocal && !isMentorTile && <span className="text-slate-400 ml-1 text-[8px] whitespace-nowrap">(You)</span>}
        </span>
        {speaking && (
          <span className="flex items-center gap-0.5 h-3">
            <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-2" style={{ animationDelay: '0ms' }} />
            <span className="w-0.5 bg-emerald-400 rounded-full animate-bounce h-3" style={{ animationDelay: '150ms' }} />
          </span>
        )}
      </div>

      {/* Top Right: Mute button (mentor only) */}
      {!isLocal && onForceMute && isMicOn && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onForceMute(participant.identity);
          }}
          className="absolute top-2.5 right-2.5 z-10 p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/45 border border-red-500/35 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-md"
          title="Force mute student"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Large Main Stage Component ───────────────────────────────────────────────
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

    const attachActiveTrack = () => {
      const pub = participant.getTrackPublication(source);
      if (pub?.track && videoRef.current) {
        pub.track.attach(videoRef.current);
        return true;
      }
      return false;
    };

    const attached = attachActiveTrack();
    let intervalId: any;
    if (!attached && isCamOn) {
      intervalId = setInterval(() => {
        if (attachActiveTrack()) {
          clearInterval(intervalId);
        }
      }, 100);
    }

    const handler = () => {
      attachActiveTrack();
    };

    participant.on('trackSubscribed', handler);
    participant.on('localTrackPublished', handler);
    participant.on('trackPublished', handler);

    return () => {
      if (intervalId) clearInterval(intervalId);
      participant.off('trackSubscribed', handler);
      participant.off('localTrackPublished', handler);
      participant.off('trackPublished', handler);
      const p = participant.getTrackPublication(source);
      if (p?.track && videoRef.current) p.track.detach(videoRef.current);
    };
  }, [participant, useScreen, isCamOn]);

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-900 shadow-xl flex items-center justify-center">
      <video ref={videoRef} autoPlay muted={isLocal} playsInline className="w-full h-full object-contain" />
      {!isCamOn && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-slate-950">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/35 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-4xl font-bold text-indigo-300">
              {(label || participant?.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <span className="text-slate-400 text-sm font-medium">{useScreen ? 'Screen share stopped' : 'Camera off'}</span>
        </div>
      )}

      {/* Overlay label bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between z-10">
        <span className="text-white text-sm font-medium flex items-center gap-2">
          {label || participant?.name}
          {isLocal && <span className="text-indigo-300 text-xs">(You)</span>}
        </span>
        {participant && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${participant.isMicrophoneEnabled ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-red-500/20 border border-red-500/30'}`}>
            {participant.isMicrophoneEnabled ? (
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4z" />
                <path d="M5.5 9.643a.75.75 0 00-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5H10.5v-1.546A6.001 6.001 0 0016 10v-.357a.75.75 0 00-1.5 0V10a4.5 4.5 0 01-9 0v-.357z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
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

// ── Raised Hand Queue (Mentor Panel Component) ───────────────────────────────
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
    <div className="space-y-2 p-3">
      {hands.map((h) => (
        <div key={h.userId} className="flex items-center justify-between bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2.5 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">✋</span>
            <div>
              <p className="text-sm font-medium text-white">{h.userName}</p>
              <p className="text-[10px] text-slate-500">
                {new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => onApprove(h.userId)}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs px-2.5 py-1.5 rounded-lg transition-all"
            >
              ✓ Allow
            </button>
            <button
              onClick={() => onDeny(h.userId)}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition-all"
            >
              ✗ Deny
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab Button Utility ───────────────────────────────────────────────────────
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-1 transition-all duration-200 ${active ? 'text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5' : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/10'
        }`}>
      {children}
    </button>
  );
}

// ── MAIN LIVESESSION COMPONENT ───────────────────────────────────────────────
export default function LiveSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const isMentor = user?.role === 'MENTOR' || user?.role === 'ADMIN';

  const [session, setSession] = useState<{ id: string; title: string; description?: string | null; status: string; startedAt?: string | null; scheduledAt?: string | null; livekitRoom?: string | null } | null>(null);
  const [sidePanel, setSidePanel] = useState<'attendance' | 'hands' | 'chat'>('chat');
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const ITEMS_PER_PAGE = isMobile ? 3 : 8;

  const [onlineCount, setOnlineCount] = useState(0);
  const [notifications, setNotifications] = useState<{ id: number; text: string; type: 'info' | 'warn' | 'success' }[]>([]);
  const [connectError, setConnectError] = useState('');
  const [sessionEnding, setSessionEnding] = useState(false);

  // Hand raise state
  const [raisedHands, setRaisedHands] = useState<{ userId: string; userName: string; time: string }[]>([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [isUnmuted, setIsUnmuted] = useState(false); // student approved to speak

  const [isFullscreen, setIsFullscreen] = useState(false);

  const livekit = useLiveKit();
  const isConnected = livekit.connectionState === ConnectionState.Connected;

  // Recording
  const recording = useRecording({
    sessionId: sessionId || '',
    room: livekit.room,
    onUploadComplete: (url) => addNotif(url ? '✅ Recording saved to storage' : '✅ Recording downloaded', 'success'),
    onError: (msg) => addNotif(msg, 'warn'),
  });

  const notifId = useRef(0);

  // Sync elapsed timer
  useEffect(() => {
    if (session?.startedAt) {
      setSessionStartTime(new Date(session.startedAt).getTime());
    } else if (isConnected && !sessionStartTime) {
      setSessionStartTime(Date.now());
    }
  }, [session?.startedAt, isConnected]);

  useEffect(() => {
    if (!sessionStartTime) return;

    const updateTimer = () => {
      const diff = Date.now() - sessionStartTime;
      if (diff < 0) {
        setElapsedTime('00:00');
        return;
      }
      const secs = Math.floor(diff / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;
      const pad = (n: number) => String(n).padStart(2, '0');
      if (h > 0) {
        setElapsedTime(`${pad(h)}:${pad(m)}:${pad(s)}`);
      } else {
        setElapsedTime(`${pad(m)}:${pad(s)}`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Error entering fullscreen:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Error exiting fullscreen:', err);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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

  // Find if anyone (including local or remote) is sharing screen
  const screenShareParticipant = (() => {
    if (!livekit.room) return null;
    if (livekit.room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.track) {
      return livekit.room.localParticipant;
    }
    for (const p of livekit.remoteParticipants) {
      if (p.getTrackPublication(Track.Source.ScreenShare)?.track) {
        return p;
      }
    }
    return null;
  })();

  const isScreenSharing = !!screenShareParticipant;

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
        setIsSidePanelOpen(true);
        addNotif(`✋ ${e.userName} raised their hand`, 'warn');
      }
    },
    onHandLowered: (userId) => {
      setRaisedHands(prev => prev.filter(h => h.userId !== userId));
      if (userId === user?.id) setIsHandRaised(false);
    },
    onUnmuteApproved: async (userId) => {
      if (userId === user?.id) {
        setIsUnmuted(true);
        setIsHandRaised(false);
        addNotif('✅ Mentor approved! You can now speak', 'success');
        await livekit.setMicEnabled(true);
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
        await livekit.setMicEnabled(false);
        addNotif('You have been muted by the mentor', 'warn');
      }
    },
    onSessionEnded: async () => {
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
    return () => {
      livekit.disconnect();
      dispatch(clearChatMessages());
    };
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
    if (!sessionId) return;
    setSessionEnding(true);
    try {
      await dispatch(endSession(sessionId)).unwrap();
      socket.broadcastSessionEnd();
      await livekit.disconnect();
      navigate('/mentor');
    } catch { setSessionEnding(false); }
  };

  const handleLeave = async () => {
    await livekit.disconnect();
    navigate(isMentor ? '/mentor' : '/student');
  };

  const toggleSidePanel = (panel: 'chat' | 'attendance' | 'hands') => {
    if (sidePanel === panel && isSidePanelOpen) {
      setIsSidePanelOpen(false);
    } else {
      setSidePanel(panel);
      setIsSidePanelOpen(true);
    }
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

  const participants = [
    ...(livekit.localParticipant ? [livekit.localParticipant] : []),
    ...livekit.remoteParticipants
  ];

  const totalPages = Math.ceil(participants.length / ITEMS_PER_PAGE);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [participants.length, totalPages, currentPage]);

  // Render the central video content area
  const renderCentralView = () => {
    const showScreenShare = isScreenSharing && screenShareParticipant;

    if (showScreenShare) {
      return (
        <div className="w-full h-full flex flex-col gap-3">
          <div className="flex-1 min-h-0 relative">
            <MainVideo
              participant={screenShareParticipant}
              isLocal={screenShareParticipant === livekit.localParticipant}
              useScreen
              label={screenShareParticipant === livekit.localParticipant ? 'Your Screen' : `${screenShareParticipant.name || 'Participant'}'s Screen`}
            />
          </div>
          {/* Scrollable list of active cameras at the bottom */}
          <div className="h-28 flex-shrink-0 flex gap-3 overflow-x-auto pb-1">
            {participants.map(p => (
              <div key={p.sid || p.identity} className="w-48 flex-shrink-0">
                <ParticipantTile
                  participant={p}
                  isLocal={p === livekit.localParticipant}
                  isMentorTile={isParticipantMentor(p)}
                  onForceMute={isMentor ? handleForceMute : undefined}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (layoutMode === 'speaker') {
      const activeSpeaker = livekit.remoteParticipants.find(p => p.isSpeaking)
        || (livekit.localParticipant?.isSpeaking ? livekit.localParticipant : null)
        || mentorParticipant
        || livekit.localParticipant;

      if (!activeSpeaker) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm mt-3">Connecting video...</p>
          </div>
        );
      }

      const otherParticipants = participants.filter(p => p !== activeSpeaker);

      return (
        <div className="w-full h-full flex flex-col gap-3">
          <div className="flex-1 min-h-0 relative">
            <MainVideo
              participant={activeSpeaker}
              isLocal={activeSpeaker === livekit.localParticipant}
              label={activeSpeaker === livekit.localParticipant ? 'You' : activeSpeaker.name || activeSpeaker.identity}
            />
          </div>
          {otherParticipants.length > 0 && (
            <div className="h-28 flex-shrink-0 flex gap-3 overflow-x-auto pb-1">
              {otherParticipants.map(p => (
                <div key={p.sid || p.identity} className="w-48 flex-shrink-0">
                  <ParticipantTile
                    participant={p}
                    isLocal={p === livekit.localParticipant}
                    isMentorTile={isParticipantMentor(p)}
                    onForceMute={isMentor ? handleForceMute : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Grid Layout Mode
    if (participants.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-indigo-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-400">Waiting for participants to connect...</p>
        </div>
      );
    }

    const validPage = currentPage > totalPages ? Math.max(totalPages, 1) : currentPage;
    const displayParticipants = isMobile
      ? participants.slice(0, validPage * ITEMS_PER_PAGE)
      : participants.slice((validPage - 1) * ITEMS_PER_PAGE, (validPage - 1) * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

    const gridColsClass =
      isMobile ? 'grid-cols-1' :
        displayParticipants.length === 1 ? 'grid-cols-1' :
          displayParticipants.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
            displayParticipants.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
              displayParticipants.length === 4 ? 'grid-cols-1 sm:grid-cols-2 sm:grid-rows-2' :
                displayParticipants.length <= 6 ? 'grid-cols-1 sm:grid-cols-3 sm:grid-rows-2' :
                  'grid-cols-1 sm:grid-cols-4 sm:grid-rows-2';

    return (
      <div className={`w-full h-full flex flex-col ${isMobile ? 'overflow-y-auto pr-1 pb-16 gap-4' : 'justify-between'}`}>
        <div className={`grid gap-3 w-full ${isMobile ? 'flex-shrink-0' : 'flex-1'} ${gridColsClass}`}>
          {displayParticipants.map((p) => (
            <ParticipantTile
              key={p.sid || p.identity}
              participant={p}
              isLocal={p === livekit.localParticipant}
              isMentorTile={isParticipantMentor(p)}
              onForceMute={isMentor ? handleForceMute : undefined}
              isCompact={displayParticipants.length > 4}
              fillHeight={!isMobile}
            />
          ))}
        </div>

        {participants.length > ITEMS_PER_PAGE && (
          <div className="flex justify-center items-center gap-4 py-2 bg-slate-900/40 border border-slate-900/60 rounded-xl flex-shrink-0 px-4">
            {validPage > 1 && (
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold border border-slate-700 text-white transition-all shadow-lg active:scale-95 duration-200"
              >
                View Less
              </button>
            )}
            {validPage < totalPages && (
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-4 py-2 rounded-xl bg-indigo-650 hover:bg-indigo-600 text-xs font-semibold border border-indigo-500/30 text-white transition-all shadow-lg active:scale-95 duration-200"
              >
                View More
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden text-white relative">
      {/* ── Top Bar Redesign ────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-slate-900 bg-slate-900/60 backdrop-blur-xl px-4 py-3 flex items-center justify-between gap-4 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/80 rounded-xl transition-all duration-200"
            title="Settings"
          >
            <SettingsIcon />
          </button>

          {/* Info Button */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="text-slate-400 hover:text-white p-2 hover:bg-slate-800/80 rounded-xl transition-all duration-200"
            title="Session Info"
          >
            <InfoIcon />
          </button>

          {/* Layout Toggle */}
          <button
            onClick={() => setLayoutMode(prev => prev === 'grid' ? 'speaker' : 'grid')}
            className={`p-2 rounded-xl transition-all duration-200 ${layoutMode === 'grid' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800/80'}`}
            title="Toggle grid layout"
          >
            <LayoutGridIcon />
          </button>
        </div>

        {/* Live Timer Pill */}
        <div className="flex items-center gap-2.5 bg-slate-955/85 border border-slate-850 px-3.5 py-1.5 rounded-full shadow-inner shadow-black/45">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-semibold text-emerald-400 font-mono tracking-wider">{elapsedTime}</span>
        </div>

        {/* End/Leave Call Button */}
        <button
          onClick={() => setShowLeaveConfirmModal(true)}
          disabled={sessionEnding}
          className="p-2.5 rounded-full bg-red-650 hover:bg-red-700 text-white shadow-lg shadow-red-900/20 active:scale-95 transition-all duration-200"
          title={isMentor ? 'End or Leave Session' : 'Leave Session'}
        >
          <HangupIcon />
        </button>
      </div>

      {/* ── Main Viewport Container ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden flex relative">

        {/* Video stream viewport */}
        <div className="flex-1 relative overflow-hidden p-4 pb-24">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-400 text-sm font-medium">{connLabel[livekit.connectionState]}</p>
            </div>
          ) : (
            renderCentralView()
          )}
        </div>

        {/* Side Panel Drawer (Desktop inline / Mobile absolute overlay) */}
        {isSidePanelOpen && (
          <>
            {/* Dark backdrop overlay on mobile only */}
            <div
              className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
              onClick={() => setIsSidePanelOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 w-80 lg:relative lg:w-72 flex-shrink-0 border-l border-slate-900 flex flex-col bg-slate-900/90 lg:bg-slate-900/40 z-50 shadow-2xl backdrop-blur-xl lg:backdrop-blur-none animate-slide-in-right">
              {/* Header Tabs */}
              <div className="flex border-b border-slate-900 flex-shrink-0 bg-slate-950/20">
                {isMentor && (
                  <TabButton active={sidePanel === 'hands'} onClick={() => setSidePanel('hands')}>
                    Hands {raisedHands.length > 0 && (
                      <span className="ml-1.5 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        {raisedHands.length}
                      </span>
                    )}
                  </TabButton>
                )}
                <TabButton active={sidePanel === 'chat'} onClick={() => setSidePanel('chat')}>
                  Chat
                </TabButton>
                <TabButton active={sidePanel === 'attendance'} onClick={() => setSidePanel('attendance')}>
                  People {isConnected && (
                    <span className="text-[10px] text-slate-400 ml-1">({onlineCount})</span>
                  )}
                </TabButton>
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-hidden flex flex-col p-2 bg-slate-900/20">
                {sidePanel === 'hands' && isMentor && (
                  <HandRaiseQueue
                    hands={raisedHands}
                    onApprove={socket.approveUnmute}
                    onDeny={socket.denyUnmute}
                  />
                )}
                {sidePanel === 'chat' && (
                  <ChatPanel onSendMessage={socket.sendChatMessage} />
                )}
                {sidePanel === 'attendance' && (
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
          </>
        )}
      </div>

      {/* ── Sticky Bottom Control Bar ────────────────────────────────────────── */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 w-[95%] sm:w-11/12 max-w-4xl bg-slate-900/90 backdrop-blur-md px-2.5 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-slate-800 shadow-2xl flex items-center justify-between gap-1.5 sm:gap-4">

        {/* Left Side Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Info Button - Desktop Only */}
          <button
            onClick={() => setShowInfoModal(true)}
            className="p-3 rounded-2xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 transition-all duration-200 hidden sm:flex"
            title="Session Info"
          >
            <InfoIcon />
          </button>

          {/* Layout Quick-toggle - Desktop Only */}
          <button
            onClick={() => setLayoutMode(prev => prev === 'grid' ? 'speaker' : 'grid')}
            className="p-3 rounded-2xl border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/80 active:scale-95 transition-all duration-200 hidden sm:flex"
            title="Switch Layout"
          >
            {layoutMode === 'grid' ? <SpeakerIcon /> : <LayoutGridIcon />}
          </button>

          {/* Mic Control */}
          <button
            onClick={isMentor ? livekit.toggleMic : handleStudentMuteToggle}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 ${!isMentor && !isUnmuted
                ? 'bg-slate-800/40 border-slate-850/50 text-slate-650 cursor-not-allowed'
                : livekit.isMicEnabled
                  ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                  : 'bg-red-500/20 border-red-500/35 text-red-400 hover:bg-red-500/30'
              }`}
            title={!isMentor && !isUnmuted ? 'Raise hand to request mic' : livekit.isMicEnabled ? 'Mute' : 'Unmute'}
          >
            <MicIcon muted={!livekit.isMicEnabled || (!isMentor && !isUnmuted)} />
          </button>

          {/* Camera Control */}
          <button
            onClick={livekit.toggleCamera}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 ${livekit.isCameraEnabled
                ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                : 'bg-red-500/20 border-red-500/35 text-red-400 hover:bg-red-500/30'
              }`}
            title={livekit.isCameraEnabled ? 'Stop Video' : 'Start Video'}
          >
            <CamIcon off={!livekit.isCameraEnabled} />
          </button>

          {/* Screen Share */}
          <button
            onClick={livekit.toggleScreenShare}
            className={`p-3 rounded-2xl border transition-all duration-200 active:scale-95 hidden sm:flex ${livekit.isScreenSharing
                ? 'bg-indigo-500/20 border-indigo-500/35 text-indigo-400 hover:bg-indigo-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-755'
              }`}
            title="Screen Share"
          >
            <ScreenIcon />
          </button>
        </div>

        {/* Right Side Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* AI Noise Cancellation - Desktop Only */}
          <button
            onClick={() => livekit.setNoiseCancellationEnabled(!livekit.isNoiseCancellationEnabled)}
            className={`p-3 rounded-2xl border transition-all duration-200 active:scale-95 hidden sm:flex ${livekit.isNoiseCancellationEnabled
                ? 'bg-emerald-500/20 border-emerald-500/35 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:bg-emerald-500/30'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-755'
              }`}
            title={livekit.isNoiseCancellationEnabled ? 'Disable AI Noise Cancellation' : 'Enable AI Noise Cancellation'}
          >
            <SparklesIcon active={livekit.isNoiseCancellationEnabled} />
          </button>

          {/* Student: Raise hand button */}
          {!isMentor && (
            <button
              onClick={handleRaiseHand}
              className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-2.5 py-2.5 sm:px-3.5 sm:py-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 ${isHandRaised
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750'
                }`}
              title={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <HandsIcon />
              <span className="hidden md:inline">{isHandRaised ? 'Lower' : 'Speak'}</span>
            </button>
          )}

          {/* Mentor: Recording toggle */}
          {isMentor && (
            <button
              onClick={() => recording.isRecording ? recording.stop() : recording.start()}
              disabled={recording.isUploading}
              className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3.5 py-3 rounded-2xl border transition-all duration-200 active:scale-95 hidden sm:flex ${recording.isRecording
                  ? 'bg-red-500/20 border-red-500/35 text-red-400 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/30'
                }`}
              title={recording.isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${recording.isRecording ? 'bg-red-500' : 'bg-slate-500'}`} />
              <span>{recording.isUploading ? 'Saving' : recording.isRecording ? 'REC' : 'Record'}</span>
            </button>
          )}

          {/* Mentor: Hands queue toggle */}
          {isMentor && (
            <button
              onClick={() => toggleSidePanel('hands')}
              className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 relative ${isSidePanelOpen && sidePanel === 'hands'
                  ? 'bg-amber-500/20 border-amber-500/35 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-755'
                }`}
              title="Hands raised queue"
            >
              <HandsIcon />
              {raisedHands.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-slate-900 animate-bounce">
                  {raisedHands.length}
                </span>
              )}
            </button>
          )}

          {/* People list toggle */}
          <button
            onClick={() => toggleSidePanel('attendance')}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 ${isSidePanelOpen && sidePanel === 'attendance'
                ? 'bg-indigo-500/20 border-indigo-500/35 text-indigo-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-750'
              }`}
            title="People List"
          >
            <PeopleIcon />
          </button>

          {/* Chat toggle */}
          <button
            onClick={() => toggleSidePanel('chat')}
            className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all duration-200 active:scale-95 relative ${isSidePanelOpen && sidePanel === 'chat'
                ? 'bg-indigo-500/20 border-indigo-500/35 text-indigo-400'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-750'
              }`}
            title="Chat Panel"
          >
            <ChatIcon />
          </button>
        </div>
      </div>

      {/* ── Notification Toasts ────────────────────────────────────────────── */}
      <div className="fixed bottom-24 left-4 space-y-2 z-50 pointer-events-none max-w-xs">
        {notifications.map((n) => (
          <div key={n.id}
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm shadow-xl animate-slide-in-right backdrop-blur-md ${n.type === 'success' ? 'bg-emerald-955/85 border border-emerald-500/30 text-emerald-200' :
                n.type === 'warn' ? 'bg-amber-955/85 border border-amber-500/30 text-amber-200' :
                  'bg-slate-900/90 border border-slate-800 text-slate-200'
              }`}>
            {n.text}
          </div>
        ))}
      </div>

      {/* ── Details Info Modal ────────────────────────────────────────────── */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowInfoModal(false)} />
          <div className="relative w-full max-w-md glass bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-scale-up text-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-white">Session Information</h3>
              <button onClick={() => setShowInfoModal(false)} className="text-slate-450 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider block">Session Title</span>
                <span className="text-white text-base font-semibold">{session?.title || 'Unknown Title'}</span>
              </div>

              {session?.description && (
                <div>
                  <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider block">Description</span>
                  <p className="text-slate-300 mt-0.5 leading-relaxed">{session.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider block">Scheduled</span>
                  <span className="text-slate-200 font-medium block mt-0.5">
                    {session?.scheduledAt ? new Date(session.scheduledAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider block">Status</span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-0.5 rounded-full text-xs font-semibold border ${session?.status === 'LIVE' ? 'bg-red-500/10 border-red-500/25 text-red-400' : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                    }`}>
                    {session?.status || 'SCHEDULED'}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-450 text-xs font-semibold uppercase tracking-wider block">LiveKit Room</span>
                <code className="text-indigo-300 bg-slate-955 px-2 py-1 rounded text-xs select-all break-all inline-block mt-0.5">
                  {session?.livekitRoom || 'Loading...'}
                </code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings Modal ────────────────────────────────────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowSettingsModal(false)} />
          <div className="relative w-full max-w-md glass bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-scale-up text-white">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold text-white">Call Settings</h3>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-450 hover:text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
                <div>
                  <span className="font-semibold block text-white">AI Noise Cancellation</span>
                  <span className="text-xs text-slate-450">Reduces background hums and noises</span>
                </div>
                <button
                  onClick={() => livekit.setNoiseCancellationEnabled(!livekit.isNoiseCancellationEnabled)}
                  className={`w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none flex items-center p-0.5 ${livekit.isNoiseCancellationEnabled ? 'bg-indigo-500' : 'bg-slate-700'
                    }`}
                >
                  <span className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ${livekit.isNoiseCancellationEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                </button>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
                <div>
                  <span className="font-semibold block text-white">Fullscreen Mode</span>
                  <span className="text-xs text-slate-450">Toggles room presentation size</span>
                </div>
                <button
                  onClick={toggleFullscreen}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-white rounded-lg text-xs font-semibold transition-all"
                >
                  {isFullscreen ? 'Exit Full' : 'Enter Full'}
                </button>
              </div>

              <div className="py-2">
                <span className="text-xs text-slate-455 uppercase font-semibold tracking-wider block mb-1">Session Connection Details</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 space-y-1.5 text-xs text-slate-350 font-mono">
                  <div>Connection: {livekit.connectionState}</div>
                  <div>User Role: {user?.role || 'STUDENT'}</div>
                  <div>Client ID: {user?.id || 'anonymous'}</div>
                  <div>Room Name: {session?.livekitRoom || 'unspecified'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End/Leave Call Confirmation Modal ────────────────────────────── */}
      {showLeaveConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowLeaveConfirmModal(false)} />
          <div className="relative w-full max-w-md glass bg-slate-900/95 border border-slate-800 rounded-2xl p-6 shadow-2xl animate-scale-up text-white">
            <h3 className="text-lg font-bold text-white mb-2">
              {isMentor ? 'End or Leave Session' : 'Leave Session'}
            </h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              {isMentor
                ? 'Would you like to end the session for all participants, or just leave the session running?'
                : 'Are you sure you want to leave the session? You can join back later if the session is still live.'}
            </p>

            <div className="flex flex-col gap-2">
              {isMentor ? (
                <>
                  <button
                    onClick={async () => {
                      setShowLeaveConfirmModal(false);
                      await handleEndSession();
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-all duration-200"
                  >
                    End Session for All
                  </button>
                  <button
                    onClick={async () => {
                      setShowLeaveConfirmModal(false);
                      await handleLeave();
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 rounded-xl border border-slate-700 transition-all"
                  >
                    Just Leave Session
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    setShowLeaveConfirmModal(false);
                    await handleLeave();
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl transition-all duration-200"
                >
                  Leave Session
                </button>
              )}

              <button
                onClick={() => setShowLeaveConfirmModal(false)}
                className="w-full bg-transparent hover:bg-white/5 text-slate-400 hover:text-white py-2.5 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
