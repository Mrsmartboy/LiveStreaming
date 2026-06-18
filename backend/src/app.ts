import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

import authRoutes from './routes/auth';
import sessionRoutes from './routes/sessions';
import questionRoutes from './routes/questions';
import recordingRoutes from './routes/recordings';
import socketHandler from './socket/socketHandler';
import prisma from './config/prisma';

const app = express();
const server = http.createServer(app);

// Allow any local-network origin (localhost, LAN IPs, Tailscale, WSL)
// so other laptops on the same Wi-Fi can access the app.
const allowedOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
  // Allow requests with no origin (mobile apps, curl, Postman)
  if (!origin) return callback(null, true);

  const localPatterns = [
    /^http:\/\/localhost/,
    /^http:\/\/127\.0\.0\.1/,
    /^http:\/\/192\.168\.\d+\.\d+/,   // Home/office LAN
    /^http:\/\/10\.\d+\.\d+\.\d+/,    // Corporate LAN
    /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+/, // Docker / private
    /^http:\/\/100\.\d+\.\d+\.\d+/,   // Tailscale
    /^https?:\/\/.*\.ngrok\.io/,       // ngrok v2 tunnels
    /^https?:\/\/.*\.ngrok-free\.app/, // ngrok free plan
    /^https?:\/\/.*\.ngrok-free\.dev/, // ngrok free plan (alt)
    /^https?:\/\/.*\.ngrok\.app/,      // ngrok paid plan
  ];

  if (localPatterns.some((re) => re.test(origin))) {
    return callback(null, true);
  }

  callback(new Error(`CORS: origin ${origin} not allowed`));
};

// ── Socket.io ──────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ── Health Check ───────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV,
    });
  } catch {
    res.status(503).json({ status: 'error', database: 'disconnected' });
  }
});

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/recordings', recordingRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error Handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Socket ─────────────────────────────────────────────────────────────────
socketHandler(io);

// ── Start Server ───────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000');

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Mentor Dashboard API running on port ${PORT}`);
  console.log(`📡 Socket.io ready`);
  console.log(`🌍 CORS: accepting all local-network origins (LAN, Tailscale, localhost)`);
});

export default app;
