import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchSessions, createSession } from '../store/slices/sessionSlice';
import SessionCard from '../components/SessionCard';
import Navbar from '../components/Navbar';

export default function MentorDashboard() {
  const dispatch = useAppDispatch();
  const { sessions, isLoading, error } = useAppSelector((s) => s.sessions);
  const { user } = useAppSelector((s) => s.auth);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', scheduledAt: '' });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

  const liveSessions = sessions.filter((s) => s.status === 'LIVE');
  const scheduledSessions = sessions.filter((s) => s.status === 'SCHEDULED');
  const endedSessions = sessions.filter((s) => s.status === 'ENDED');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.title.trim() || !form.scheduledAt) {
      setFormError('Title and scheduled time are required');
      return;
    }
    setCreating(true);
    try {
      await dispatch(createSession({
        title: form.title,
        description: form.description || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
      })).unwrap();
      setShowModal(false);
      setForm({ title: '', description: '', scheduledAt: '' });
    } catch (err: unknown) {
      setFormError(err as string);
    } finally {
      setCreating(false);
    }
  };

  const stats = [
    { label: 'Live Now', value: liveSessions.length, color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', icon: '🔴' },
    { label: 'Scheduled', value: scheduledSessions.length, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', icon: '📅' },
    { label: 'Completed', value: endedSessions.length, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: '✅' },
    { label: 'Total', value: sessions.length, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="page-title">Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
            <p className="text-slate-400 mt-1">Manage your sessions and students</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-brand flex items-center gap-2 self-start sm:self-auto">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Session
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className={`stat-card border ${stat.bg}`}>
              <div className="text-2xl">{stat.icon}</div>
              <div className={`text-3xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-slate-400 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading sessions...</span>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Live Sessions */}
            {liveSessions.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  Live Sessions
                </h2>
                <div className="space-y-3">
                  {liveSessions.map((s) => (
                    <SessionCard key={s.id} session={s} showControls />
                  ))}
                </div>
              </section>
            )}

            {/* Scheduled */}
            {scheduledSessions.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upcoming Sessions
                </h2>
                <div className="space-y-3">
                  {scheduledSessions.map((s) => (
                    <SessionCard key={s.id} session={s} showControls />
                  ))}
                </div>
              </section>
            )}

            {/* Past */}
            {endedSessions.length > 0 && (
              <section className="animate-fade-in">
                <h2 className="text-lg font-semibold text-slate-400 mb-3">Past Sessions</h2>
                <div className="space-y-3">
                  {endedSessions.slice(0, 5).map((s) => (
                    <SessionCard key={s.id} session={s} showControls />
                  ))}
                </div>
              </section>
            )}

            {sessions.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-slate-300 font-semibold text-lg mb-2">No sessions yet</h3>
                <p className="text-slate-500 mb-6">Create your first session to get started</p>
                <button onClick={() => setShowModal(true)} className="btn-brand">
                  Create First Session
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md glass-card p-6 animate-slide-up">
            <h3 className="text-xl font-bold text-white mb-6">Create New Session</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Session Title *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. React Hooks Deep Dive"
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What will be covered in this session?"
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Scheduled At *</label>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-outline flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn-brand flex-1 flex items-center justify-center gap-2">
                  {creating ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creating...</>
                  ) : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
