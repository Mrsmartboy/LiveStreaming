import React, { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { fetchSessions } from '../store/slices/sessionSlice';
import SessionCard from '../components/SessionCard';
import Navbar from '../components/Navbar';

export default function Recordings() {
  const dispatch = useAppDispatch();
  const { sessions, isLoading } = useAppSelector((s) => s.sessions);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(fetchSessions());
  }, [dispatch]);

  // Filter sessions: only show completed sessions that have recordings
  const recordings = sessions.filter(
    (s) => s.status === 'ENDED' && s.recordingUrl
  );

  const filteredRecordings = recordings.filter((r) =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.description && r.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
        {/* Header and Search */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <h1 className="page-title text-white font-bold text-3xl">Session Recordings</h1>
            <p className="text-slate-400 mt-1">Watch and learn from completed live streaming classes</p>
          </div>
          
          <div className="relative max-w-sm w-full">
            <input
              type="text"
              placeholder="Search recordings by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-slate-400 text-sm">Loading recordings...</span>
            </div>
          </div>
        ) : filteredRecordings.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {filteredRecordings.map((r) => (
                <SessionCard key={r.id} session={r} />
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-slate-300 font-semibold text-lg mb-2">
              {search ? 'No search results' : 'No recordings available'}
            </h3>
            <p className="text-slate-500">
              {search ? 'Try looking for another topic' : 'Check back later for completed sessions'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
