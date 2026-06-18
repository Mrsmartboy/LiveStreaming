import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import MentorDashboard from './pages/MentorDashboard';
import StudentDashboard from './pages/StudentDashboard';
import LiveSession from './pages/LiveSession';
import AdminPanel from './pages/AdminPanel';
import { useAppSelector } from './store';

function RoleRedirect() {
  const { user, isAuthenticated } = useAppSelector((s) => s.auth);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role === 'MENTOR' || user?.role === 'ADMIN') return <Navigate to="/mentor" replace />;
  return <Navigate to="/student" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RoleRedirect />} />
      <Route path="/mentor" element={<ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}><MentorDashboard /></ProtectedRoute>} />
      <Route path="/mentor/admin" element={<ProtectedRoute allowedRoles={['MENTOR', 'ADMIN']}><AdminPanel /></ProtectedRoute>} />
      <Route path="/student" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
      <Route path="/session/:sessionId" element={<ProtectedRoute><LiveSession /></ProtectedRoute>} />
      <Route path="/recordings" element={<ProtectedRoute><RoleRedirect /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </Provider>
  );
}
