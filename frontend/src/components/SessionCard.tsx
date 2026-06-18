import React from 'react';
import { Link } from 'react-router-dom';
import { Session } from '../store/slices/sessionSlice';
import { useAppDispatch, useAppSelector } from '../store';
import { startSession, endSession, deleteSession } from '../store/slices/sessionSlice';

interface SessionCardProps {
  session: Session;
  showControls?: boolean;
}

export default function SessionCard({ session, showControls = false }: SessionCardProps) {
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((s) => s.auth);
  const isMentor = user?.role === 'MENTOR' || user?.role === 'ADMIN';

  const handleStart = (e: React.MouseEvent) => {
    e.preventDefault();
    dispatch(startSession(session.id));
  };

  const handleEnd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('End this session?')) {
      dispatch(endSession(session.id));
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm('Delete this session? This cannot be undone.')) {
      dispatch(deleteSession(session.id));
    }
  };

  const statusConfig = {
    LIVE: { label: 'Live', class: 'badge-live' },
    SCHEDULED: { label: 'Scheduled', class: 'badge-scheduled' },
    ENDED: { label: 'Ended', class: 'badge-ended' },
  };
  const status = statusConfig[session.status];

  return (
    <div className="card hover:border-slate-700 transition-all duration-200 group animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={status.class}>
              {session.status === 'LIVE' && (
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              )}
              {status.label}
            </span>
            <span className="text-slate-500 text-xs">
              {new Date(session.scheduledAt).toLocaleDateString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors duration-200 truncate">
            {session.title}
          </h3>
          {session.description && (
            <p className="text-slate-400 text-sm mt-1 line-clamp-2">{session.description}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 mt-3">
            {session._count && (
              <>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {session._count.attendance} students
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {session._count.questions} questions
                </span>
              </>
            )}
            {session.recordingUrl && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-400">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Recorded
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2">
          {session.status === 'LIVE' && (
            <Link
              to={`/session/${session.id}`}
              className="btn-brand text-sm py-2 px-4 inline-flex items-center gap-2"
            >
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Join
            </Link>
          )}

          {isMentor && showControls && (
            <div className="flex gap-2">
              {session.status === 'SCHEDULED' && (
                <button onClick={handleStart} className="btn-success text-xs py-1.5 px-3">
                  Start
                </button>
              )}
              {session.status === 'LIVE' && (
                <button onClick={handleEnd} className="btn-danger text-xs py-1.5 px-3">
                  End
                </button>
              )}
              {session.status !== 'LIVE' && (
                <button onClick={handleDelete} className="btn-danger text-xs py-1.5 px-3">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}

          {session.status === 'ENDED' && session.recordingUrl && (
            <a
              href={session.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-outline text-xs py-1.5 px-3 inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Watch
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
