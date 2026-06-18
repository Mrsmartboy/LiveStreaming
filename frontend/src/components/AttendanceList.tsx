import React, { useEffect, useState } from 'react';
import { RemoteParticipant } from 'livekit-client';
import api from '../services/api';

interface AttendanceRecord {
  id: string;
  userId: string;
  sessionId: string;
  joinedAt: string;
  leftAt: string | null;
  user: { name: string; email: string };
}

interface AttendanceListProps {
  sessionId: string;
  onlineCount?: number;
  remoteParticipants?: RemoteParticipant[];
  onForceMute?: (userId: string) => void;
  onApproveUnmute?: (userId: string) => void;
}

export default function AttendanceList({
  sessionId,
  onlineCount,
  remoteParticipants = [],
  onForceMute,
  onApproveUnmute,
}: AttendanceListProps) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<AttendanceRecord[]>(`/sessions/${sessionId}/attendance`)
      .then((res) => setRecords(res.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [sessionId, onlineCount]); // re-fetch when count changes

  const duration = (r: AttendanceRecord) => {
    const end = r.leftAt ? new Date(r.leftAt) : new Date();
    const start = new Date(r.joinedAt);
    const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
    return mins > 0 ? `${mins}m` : '<1m';
  };

  // Find the LiveKit participant matching a userId (identity)
  const getLiveParticipant = (userId: string) =>
    remoteParticipants.find((p) => p.identity === userId);

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="font-semibold text-sm text-white">People</span>
          <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold px-2 py-0.5 rounded-full">
            {onlineCount ?? records.filter((r) => !r.leftAt).length} live
          </span>
        </div>
        <span className="text-slate-500 text-xs">{records.length} total</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-slate-500">
            <svg className="w-10 h-10 mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm">No attendees yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {records.map((r) => {
              const liveP = getLiveParticipant(r.userId);
              const isOnline = !r.leftAt;
              const isMicOn = liveP?.isMicrophoneEnabled ?? false;

              return (
                <div key={r.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/30 transition-colors group">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isOnline ? 'bg-emerald-500/20 border border-emerald-500/40' : 'bg-slate-700/40 border border-slate-700'
                    }`}>
                      <span className={`text-xs font-bold ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {r.user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{r.user.name}</p>
                      <p className="text-xs text-slate-500 truncate">{r.user.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {/* Mic status indicator */}
                    {isOnline && liveP && (
                      <span className={`w-2 h-2 rounded-full ${isMicOn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} title={isMicOn ? 'Mic on' : 'Mic off'} />
                    )}

                    {/* Mentor mute/unmute controls */}
                    {isOnline && liveP && (onForceMute || onApproveUnmute) && (
                      <>
                        {isMicOn ? (
                          <button
                            onClick={() => onForceMute?.(r.userId)}
                            title="Mute student"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-all"
                          >
                            {/* Mute icon */}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => onApproveUnmute?.(r.userId)}
                            title="Allow student to speak"
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition-all"
                          >
                            {/* Unmute icon */}
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}

                    {/* Online/offline status */}
                    <div className="flex flex-col items-end gap-0.5">
                      {isOnline ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          Online
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">{duration(r)}</span>
                      )}
                      <span className="text-xs text-slate-600">
                        {new Date(r.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
