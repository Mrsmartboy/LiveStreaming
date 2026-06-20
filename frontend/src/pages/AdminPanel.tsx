import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import api from '../services/api';

interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  _count: { attendance: number; questions: number };
}

export default function AdminPanel() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'STUDENT' | 'MENTOR'>('STUDENT');

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const endpoint = activeTab === 'STUDENT' ? '/auth/students' : '/auth/mentors';
      const { data } = await api.get<UserAccount[]>(endpoint);
      setUsers(data);
    } catch {
      setMsg({ type: 'error', text: `Failed to load ${activeTab.toLowerCase()}s` });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [activeTab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      const endpoint = activeTab === 'STUDENT' ? '/auth/create-student' : '/auth/create-mentor';
      await api.post(endpoint, form);
      setMsg({ type: 'success', text: `Account created for ${form.email}` });
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      await loadUsers();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setMsg({ type: 'error', text: error.response?.data?.error || 'Failed to create account' });
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}'s account? This cannot be undone.`)) return;
    try {
      const endpoint = activeTab === 'STUDENT' ? `/auth/students/${id}` : `/auth/mentors/${id}`;
      await api.delete(endpoint);
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setMsg({ type: 'success', text: `${name}'s account deleted` });
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete account' });
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-fade-in">
          <div>
            <h1 className="page-title">Admin Panel</h1>
            <p className="text-slate-400 mt-1">Manage accounts</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="btn-brand flex items-center gap-2 self-start">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add {activeTab === 'STUDENT' ? 'Student' : 'Mentor'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-slate-800 mb-6 mt-4">
          <button
            onClick={() => setActiveTab('STUDENT')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'STUDENT'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setActiveTab('MENTOR')}
            className={`pb-3 px-2 text-sm font-medium transition-colors ${
              activeTab === 'MENTOR'
                ? 'text-indigo-400 border-b-2 border-indigo-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Mentors
          </button>
        </div>

        {/* Message */}
        {msg && (
          <div className={`mb-6 flex items-center gap-2 rounded-xl px-4 py-3 text-sm animate-fade-in ${
            msg.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-red-500/10 border border-red-500/30 text-red-400'
          }`}>
            {msg.type === 'success'
              ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
            }
            {msg.text}
            <button onClick={() => setMsg(null)} className="ml-auto text-current opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        {/* Create Form */}
        {showForm && (
          <div className="card mb-8 animate-slide-up">
            <h2 className="text-lg font-semibold text-white mb-4">Create {activeTab === 'STUDENT' ? 'Student' : 'Mentor'} Account</h2>
            <form onSubmit={handleCreate} className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                  required
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Temporary Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Min. 6 characters"
                  required
                  minLength={6}
                  className="input-field"
                />
              </div>
              <div className="sm:col-span-3 flex gap-3">
                <button type="submit" disabled={creating} className="btn-brand flex items-center gap-2">
                  {creating ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Creating...</>
                  ) : 'Create Account'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="btn-outline">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Students Table */}
        <div className="card animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              {activeTab === 'STUDENT' ? 'Students' : 'Mentors'} <span className="text-slate-500 font-normal text-sm">({filtered.length})</span>
            </h2>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="input-field pl-9 py-2 text-sm w-48"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              {search ? 'No accounts match your search' : `No ${activeTab.toLowerCase()}s yet. Create one above.`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3">{activeTab === 'STUDENT' ? 'Student' : 'Mentor'}</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 hidden sm:table-cell">Sessions</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 hidden sm:table-cell">Questions</th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider pb-3 hidden md:table-cell">Joined</th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider pb-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filtered.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-indigo-400">
                              {u.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-white">{u.name}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 hidden sm:table-cell">
                        <span className="text-sm text-slate-300">{u._count.attendance}</span>
                      </td>
                      <td className="py-3.5 hidden sm:table-cell">
                        <span className="text-sm text-slate-300">{u._count.questions}</span>
                      </td>
                      <td className="py-3.5 hidden md:table-cell">
                        <span className="text-xs text-slate-500">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button
                          onClick={() => handleDelete(u.id, u.name)}
                          className="opacity-0 group-hover:opacity-100 btn-danger text-xs py-1.5 px-2.5 transition-opacity"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
