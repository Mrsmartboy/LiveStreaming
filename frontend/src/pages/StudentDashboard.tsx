import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchSessions } from '../store/slices/sessionSlice';
import SessionCard from '../components/SessionCard';
import Navbar from '../components/Navbar';

export default function StudentDashboard() {
  const dispatch = useAppDispatch();
  const { sessions, isLoading } = useAppSelector((s) => s.sessions);
  const { user } = useAppSelector((s) => s.auth);

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

  const liveSessions = sessions.filter((s) => s.status === 'LIVE');
  const scheduledSessions = sessions.filter((s) => s.status === 'SCHEDULED');
  const endedSessions = sessions.filter((s) => s.status === 'ENDED' && s.recordingUrl);

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <h1 className="page-title">Hello, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-slate-400 mt-1">Join live sessions and learn from your mentor</p>
        </div>

        {/* Live session banner */}
        {liveSessions.length > 0 && (
          <div className="mb-8 animate-fade-in">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-6">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="live-pulse" />
                  <span className="text-white/80 text-sm font-medium">Live Right Now</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-1">{liveSessions[0].title}</h2>
                {liveSessions[0].description && (
                  <p className="text-white/70 text-sm mb-4">{liveSessions[0].description}</p>
                )}
                <Link
                  to={`/session/${liveSessions[0].id}`}
                  onClick={() => {
                    document.documentElement.requestFullscreen().catch((err) => {
                      console.error('Error entering fullscreen:', err);
                    });
                  }}
                  className="inline-flex items-center gap-2 bg-white text-indigo-600 font-bold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors duration-200"
                >
                  Join Session
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming */}
            {scheduledSessions.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upcoming Sessions
                </h2>
                <div className="space-y-3">
                  {scheduledSessions.map((s) => <SessionCard key={s.id} session={s} />)}
                </div>
              </section>
            )}

            {/* Recordings */}
            {endedSessions.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Available Recordings
                </h2>
                <div className="space-y-3">
                  {endedSessions.map((s) => <SessionCard key={s.id} session={s} />)}
                </div>
              </section>
            )}

            {sessions.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h3 className="text-slate-300 font-semibold text-lg mb-2">No sessions available</h3>
                <p className="text-slate-500">Your mentor hasn't scheduled any sessions yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
