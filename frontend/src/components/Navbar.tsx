import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { logout } from '../store/slices/authSlice';
import api from '../services/api';

export default function Navbar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user } = useAppSelector((s) => s.auth);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (_) {
      // silently ignore
    } finally {
      dispatch(logout());
      navigate('/login');
    }
  };

  const isMentor = user?.role === 'MENTOR' || user?.role === 'ADMIN';

  const roleColors: Record<string, string> = {
    ADMIN: 'bg-red-500/20 text-red-400 border-red-500/30',
    MENTOR: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    STUDENT: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={isMentor ? '/mentor' : '/student'} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:shadow-indigo-500/50 transition-shadow duration-200">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="font-bold text-lg gradient-text hidden sm:block">Live Stream</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {isMentor ? (
              <>
                <NavLink to="/mentor">Dashboard</NavLink>
                <NavLink to="/mentor/admin">Admin Panel</NavLink>
                <NavLink to="/recordings">Recordings</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/student">Dashboard</NavLink>
                <NavLink to="/recordings">Recordings</NavLink>
              </>
            )}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full border ${roleColors[user?.role || 'STUDENT']}`}
              >
                {user?.role}
              </span>
              <span className="text-sm text-slate-300 font-medium">{user?.name}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
        isActive
          ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
      }`}
    >
      {children}
    </Link>
  );
}
