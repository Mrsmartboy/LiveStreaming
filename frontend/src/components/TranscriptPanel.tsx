import React, { useEffect, useRef } from 'react';
import { TranscriptEntry } from '../hooks/useTranscript';

interface TranscriptPanelProps {
  entries: TranscriptEntry[];
  isEnabled: boolean;
  onToggle: () => void;
}

export default function TranscriptPanel({ entries, isEnabled, onToggle }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex flex-col h-full">
      {/* Header + Toggle */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="font-semibold text-sm text-white">Live Transcript</span>
          {isEnabled && (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
            isEnabled
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 hover:bg-violet-500/30'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {isEnabled ? 'Stop' : 'Start'}
        </button>
      </div>

      {/* Transcript entries */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-12">
            <svg className="w-10 h-10 mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            <p className="text-sm text-center">
              {isEnabled ? 'Start speaking...' : 'Press Start to enable live transcript'}
            </p>
          </div>
        ) : (
          <>
            {/* Group consecutive entries by same speaker */}
            {entries.map((entry, i) => {
              const prevEntry = entries[i - 1];
              const showSpeaker = !prevEntry || prevEntry.userId !== entry.userId || !prevEntry.isFinal;

              return (
                <div key={entry.id} className={`${entry.isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
                  {showSpeaker && (
                    <div className={`flex items-center gap-1.5 mb-1 ${entry.isSelf ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        entry.isSelf ? 'bg-indigo-500/30 text-indigo-400' : 'bg-violet-500/30 text-violet-400'
                      }`}>
                        {entry.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs text-slate-500 font-medium">{entry.isSelf ? 'You' : entry.userName}</span>
                      <span className="text-[10px] text-slate-600">{formatTime(entry.time)}</span>
                    </div>
                  )}
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed transition-all ${
                    entry.isFinal
                      ? entry.isSelf
                        ? 'bg-indigo-500/15 border border-indigo-500/30 text-slate-200'
                        : 'bg-slate-800 border border-slate-700 text-slate-200'
                      : 'bg-slate-800/50 border border-slate-700/50 text-slate-400 italic'
                  }`}>
                    {entry.text}
                    {!entry.isFinal && (
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
