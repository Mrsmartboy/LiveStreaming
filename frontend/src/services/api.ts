import axios from 'axios';
import { store } from '../store';
import { logout } from '../store/slices/authSlice';

// Use relative URLs so requests always go through the Vite proxy.
// This works correctly whether accessed from localhost OR another device
// on the local network (http://192.168.x.x:5173) — the proxy runs
// server-side and forwards /api/* → http://backend:5000.
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request Interceptor – attach JWT ───────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = store.getState().auth.token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor – handle 401 ─────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid → logout
      store.dispatch(logout());
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
