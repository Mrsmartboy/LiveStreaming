# Mentor Dashboard – Implementation Guide

> Live streaming platform where registered students join sessions in the browser, ask questions live, and sessions are recorded.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Backend Setup (Node.js + Express)](#5-backend-setup)
6. [Authentication (JWT)](#6-authentication-jwt)
7. [Live Streaming (Agora.io)](#7-live-streaming-agoraio)
8. [Real-time Q&A (Socket.io)](#8-real-time-qa-socketio)
9. [Attendance Tracking](#9-attendance-tracking)
10. [Session Recording](#10-session-recording)
11. [Frontend Setup (React)](#11-frontend-setup-react)
12. [Admin Panel – Create Student Accounts](#12-admin-panel)
13. [Environment Variables](#13-environment-variables)
14. [Deployment](#14-deployment)
15. [API Reference](#15-api-reference)

---

## 1. Project Overview

### What it does

- Mentor starts a **live video session** (camera + screen share)
- Only **registered students** (accounts created by admin/mentor) can log in
- Students **watch the stream in the browser** — no app download needed
- Students **ask questions live** — mentor sees them on dashboard
- Mentor can **share solutions** via screen share or uploaded video
- Mentor sees **who joined**, what time they joined/left
- Every session is **recorded automatically** and stored for playback

### User Roles

| Role | Permissions |
|------|-------------|
| Admin / Mentor | Create student accounts, start sessions, manage recordings |
| Student | Login, join sessions, ask questions, view recordings |

---

## 2. Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React.js + Vite | Student & mentor UI |
| Backend | Node.js + Express | REST API + business logic |
| Real-time | Socket.io | Live Q&A, attendance events |
| Video | Agora.io (RTC SDK) | Live streaming in browser |
| Recording | Agora Cloud Recording | Auto-record sessions |
| Database | PostgreSQL + Prisma ORM | Users, sessions, Q&A, attendance |
| Auth | JWT (JSON Web Tokens) | Secure login, route protection |
| Storage | AWS S3 | Store recorded videos |
| Hosting | Render / Railway (backend), Vercel (frontend) | Deployment |

---

## 3. Project Structure

```
mentor-dashboard/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── sessionController.js
│   │   │   ├── questionController.js
│   │   │   └── recordingController.js
│   │   ├── middleware/
│   │   │   ├── authMiddleware.js
│   │   │   └── roleMiddleware.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── sessions.js
│   │   │   ├── questions.js
│   │   │   └── recordings.js
│   │   ├── socket/
│   │   │   └── socketHandler.js
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── app.js
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Login.jsx
    │   │   ├── StudentDashboard.jsx
    │   │   ├── MentorDashboard.jsx
    │   │   ├── LiveSession.jsx
    │   │   └── AdminPanel.jsx
    │   ├── components/
    │   │   ├── VideoPlayer.jsx
    │   │   ├── QuestionPanel.jsx
    │   │   └── AttendanceList.jsx
    │   ├── hooks/
    │   │   └── useAgora.js
    │   └── App.jsx
    ├── .env
    └── package.json
```

---

## 4. Database Schema

### Prisma Schema (`backend/src/prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String       @id @default(uuid())
  name         String
  email        String       @unique
  password     String
  role         Role         @default(STUDENT)
  createdAt    DateTime     @default(now())
  attendance   Attendance[]
  questions    Question[]
}

enum Role {
  ADMIN
  MENTOR
  STUDENT
}

model Session {
  id           String       @id @default(uuid())
  title        String
  description  String?
  scheduledAt  DateTime
  startedAt    DateTime?
  endedAt      DateTime?
  agoraChannel String       @unique
  recordingUrl String?
  status       SessionStatus @default(SCHEDULED)
  createdAt    DateTime     @default(now())
  attendance   Attendance[]
  questions    Question[]
}

enum SessionStatus {
  SCHEDULED
  LIVE
  ENDED
}

model Attendance {
  id        String   @id @default(uuid())
  userId    String
  sessionId String
  joinedAt  DateTime @default(now())
  leftAt    DateTime?
  user      User     @relation(fields: [userId], references: [id])
  session   Session  @relation(fields: [sessionId], references: [id])
}

model Question {
  id        String   @id @default(uuid())
  text      String
  answered  Boolean  @default(false)
  userId    String
  sessionId String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  session   Session  @relation(fields: [sessionId], references: [id])
}
```

### Setup database

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
```

---

## 5. Backend Setup

### Install dependencies

```bash
cd backend
npm init -y
npm install express prisma @prisma/client bcryptjs jsonwebtoken
npm install socket.io cors dotenv axios
npm install --save-dev nodemon
```

### `backend/src/app.js`

```js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const sessionRoutes = require('./routes/sessions');
const questionRoutes = require('./routes/questions');
const recordingRoutes = require('./routes/recordings');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.FRONTEND_URL, methods: ['GET', 'POST'] }
});

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/recordings', recordingRoutes);

socketHandler(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

---

## 6. Authentication (JWT)

### `backend/src/controllers/authController.js`

```js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Admin creates a student account
exports.createStudent = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role: 'STUDENT' }
    });
    res.json({ message: 'Student account created', userId: user.id });
  } catch (err) {
    res.status(400).json({ error: 'Email already exists' });
  }
};

// Student login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
};
```

### `backend/src/middleware/authMiddleware.js`

```js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

### `backend/src/middleware/roleMiddleware.js`

```js
module.exports = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Access forbidden' });
  }
  next();
};
```

### Auth routes (`backend/src/routes/auth.js`)

```js
const router = require('express').Router();
const { login, createStudent } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');

router.post('/login', login);
router.post('/create-student', auth, role('ADMIN', 'MENTOR'), createStudent);

module.exports = router;
```

---

## 7. Live Streaming (Agora.io)

### Setup

1. Create a free account at [agora.io](https://www.agora.io)
2. Create a new project → get **App ID** and **App Certificate**
3. Install the SDK in the frontend:

```bash
cd frontend
npm install agora-rtc-sdk-ng
```

### Generate Agora Token (backend)

```bash
npm install agora-token
```

```js
// backend/src/controllers/sessionController.js
const { RtcTokenBuilder, RtcRole } = require('agora-token');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getAgoraToken = async (req, res) => {
  const { sessionId } = req.params;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session || session.status === 'ENDED') {
    return res.status(404).json({ error: 'Session not available' });
  }

  const role = req.user.role === 'MENTOR' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireTime = 3600; // 1 hour
  const currentTime = Math.floor(Date.now() / 1000);
  const privilegeExpireTime = currentTime + expireTime;

  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    session.agoraChannel,
    req.user.userId,
    role,
    privilegeExpireTime
  );

  res.json({ token, channel: session.agoraChannel, appId: process.env.AGORA_APP_ID });
};
```

### Frontend Agora Hook (`frontend/src/hooks/useAgora.js`)

```js
import AgoraRTC from 'agora-rtc-sdk-ng';
import { useState, useRef } from 'react';

export function useAgora() {
  const client = useRef(AgoraRTC.createClient({ mode: 'live', codec: 'vp8' }));
  const [remoteUsers, setRemoteUsers] = useState([]);
  const localVideoRef = useRef(null);

  const joinAsMentor = async (appId, channel, token, uid) => {
    await client.current.setClientRole('host');
    await client.current.join(appId, channel, token, uid);

    const videoTrack = await AgoraRTC.createCameraVideoTrack();
    const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();

    videoTrack.play(localVideoRef.current);
    await client.current.publish([videoTrack, audioTrack]);
  };

  const joinAsStudent = async (appId, channel, token, uid) => {
    await client.current.setClientRole('audience');
    await client.current.join(appId, channel, token, uid);

    client.current.on('user-published', async (user, mediaType) => {
      await client.current.subscribe(user, mediaType);
      if (mediaType === 'video') {
        setRemoteUsers(prev => [...prev, user]);
        user.videoTrack.play(`remote-video-${user.uid}`);
      }
      if (mediaType === 'audio') {
        user.audioTrack.play();
      }
    });
  };

  const leave = async () => {
    await client.current.leave();
    setRemoteUsers([]);
  };

  return { localVideoRef, remoteUsers, joinAsMentor, joinAsStudent, leave };
}
```

---

## 8. Real-time Q&A (Socket.io)

### Backend socket handler (`backend/src/socket/socketHandler.js`)

```js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

module.exports = (io) => {

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // Student joins a session room
    socket.on('join-session', ({ sessionId, userId, userName }) => {
      socket.join(sessionId);

      // Log attendance
      prisma.attendance.create({
        data: { userId, sessionId }
      }).catch(console.error);

      // Notify mentor
      io.to(sessionId).emit('student-joined', { userId, userName, time: new Date() });
    });

    // Student sends a question
    socket.on('send-question', async ({ sessionId, userId, text }) => {
      const question = await prisma.question.create({
        data: { text, userId, sessionId },
        include: { user: { select: { name: true } } }
      });
      io.to(sessionId).emit('new-question', question);
    });

    // Mentor marks question as answered
    socket.on('answer-question', async ({ questionId, sessionId }) => {
      await prisma.question.update({
        where: { id: questionId },
        data: { answered: true }
      });
      io.to(sessionId).emit('question-answered', { questionId });
    });

    // Student leaves
    socket.on('leave-session', async ({ sessionId, userId }) => {
      socket.leave(sessionId);
      await prisma.attendance.updateMany({
        where: { userId, sessionId, leftAt: null },
        data: { leftAt: new Date() }
      });
      io.to(sessionId).emit('student-left', { userId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
    });
  });

};
```

### Frontend Q&A component (`frontend/src/components/QuestionPanel.jsx`)

```jsx
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io(import.meta.env.VITE_BACKEND_URL);

export default function QuestionPanel({ sessionId, userId, userName, isMentor }) {
  const [questions, setQuestions] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    socket.emit('join-session', { sessionId, userId, userName });

    socket.on('new-question', (q) => {
      setQuestions(prev => [q, ...prev]);
    });

    socket.on('question-answered', ({ questionId }) => {
      setQuestions(prev =>
        prev.map(q => q.id === questionId ? { ...q, answered: true } : q)
      );
    });

    return () => {
      socket.emit('leave-session', { sessionId, userId });
      socket.off('new-question');
      socket.off('question-answered');
    };
  }, [sessionId]);

  const sendQuestion = () => {
    if (!input.trim()) return;
    socket.emit('send-question', { sessionId, userId, text: input });
    setInput('');
  };

  const markAnswered = (questionId) => {
    socket.emit('answer-question', { questionId, sessionId });
  };

  return (
    <div>
      {!isMentor && (
        <div>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..."
          />
          <button onClick={sendQuestion}>Send</button>
        </div>
      )}
      <ul>
        {questions.map(q => (
          <li key={q.id} style={{ opacity: q.answered ? 0.5 : 1 }}>
            <strong>{q.user?.name}:</strong> {q.text}
            {isMentor && !q.answered && (
              <button onClick={() => markAnswered(q.id)}>Mark answered</button>
            )}
            {q.answered && <span> ✓ Answered</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 9. Attendance Tracking

Attendance is tracked automatically via socket events (join + leave). To view attendance for a session:

### API route

```js
// GET /api/sessions/:sessionId/attendance
router.get('/:sessionId/attendance', auth, role('MENTOR', 'ADMIN'), async (req, res) => {
  const records = await prisma.attendance.findMany({
    where: { sessionId: req.params.sessionId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { joinedAt: 'asc' }
  });
  res.json(records);
});
```

### Frontend Attendance List (`frontend/src/components/AttendanceList.jsx`)

```jsx
import { useEffect, useState } from 'react';
import axios from 'axios';

export default function AttendanceList({ sessionId, token }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    axios.get(`/api/sessions/${sessionId}/attendance`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => setRecords(res.data));
  }, [sessionId]);

  return (
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Joined at</th>
          <th>Left at</th>
        </tr>
      </thead>
      <tbody>
        {records.map(r => (
          <tr key={r.id}>
            <td>{r.user.name}</td>
            <td>{new Date(r.joinedAt).toLocaleTimeString()}</td>
            <td>{r.leftAt ? new Date(r.leftAt).toLocaleTimeString() : 'Still in session'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

---

## 10. Session Recording

Agora Cloud Recording saves the session to AWS S3 automatically.

### Start recording (call this when mentor starts the session)

```js
// backend/src/controllers/recordingController.js
const axios = require('axios');

const AGORA_BASE = 'https://api.agora.io/v1/apps';

exports.startRecording = async (req, res) => {
  const { sessionId, channel, token, uid } = req.body;
  const appId = process.env.AGORA_APP_ID;
  const auth = Buffer.from(`${process.env.AGORA_CUSTOMER_KEY}:${process.env.AGORA_CUSTOMER_SECRET}`).toString('base64');

  // Step 1: Acquire resource
  const { data: acquireData } = await axios.post(
    `${AGORA_BASE}/${appId}/cloud_recording/acquire`,
    { cname: channel, uid: String(uid), clientRequest: {} },
    { headers: { Authorization: `Basic ${auth}` } }
  );

  const resourceId = acquireData.resourceId;

  // Step 2: Start recording
  const { data: startData } = await axios.post(
    `${AGORA_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/mode/mix/start`,
    {
      cname: channel,
      uid: String(uid),
      clientRequest: {
        token,
        recordingConfig: { maxIdleTime: 30, streamTypes: 2 },
        storageConfig: {
          vendor: 1, // AWS S3
          region: 0,
          bucket: process.env.AWS_S3_BUCKET,
          accessKey: process.env.AWS_ACCESS_KEY,
          secretKey: process.env.AWS_SECRET_KEY,
          fileNamePrefix: ['recordings', sessionId]
        }
      }
    },
    { headers: { Authorization: `Basic ${auth}` } }
  );

  res.json({ resourceId, sid: startData.sid });
};

exports.stopRecording = async (req, res) => {
  const { resourceId, sid, channel, uid, sessionId } = req.body;
  const appId = process.env.AGORA_APP_ID;
  const auth = Buffer.from(`${process.env.AGORA_CUSTOMER_KEY}:${process.env.AGORA_CUSTOMER_SECRET}`).toString('base64');

  const { data } = await axios.post(
    `${AGORA_BASE}/${appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
    { cname: channel, uid: String(uid), clientRequest: {} },
    { headers: { Authorization: `Basic ${auth}` } }
  );

  // Save recording URL to DB
  const recordingUrl = `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/recordings/${sessionId}/...`;
  await prisma.session.update({
    where: { id: sessionId },
    data: { recordingUrl, status: 'ENDED', endedAt: new Date() }
  });

  res.json({ message: 'Recording stopped', data });
};
```

---

## 11. Frontend Setup (React)

### Install dependencies

```bash
cd frontend
npm create vite@latest . -- --template react
npm install axios socket.io-client agora-rtc-sdk-ng react-router-dom
```

### Login page (`frontend/src/pages/Login.jsx`)

```jsx
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user.role === 'MENTOR' || data.user.role === 'ADMIN') {
        navigate('/mentor/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    } catch {
      setError('Invalid email or password');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Live session page (`frontend/src/pages/LiveSession.jsx`)

```jsx
import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAgora } from '../hooks/useAgora';
import QuestionPanel from '../components/QuestionPanel';
import axios from 'axios';

export default function LiveSession() {
  const { sessionId } = useParams();
  const user = JSON.parse(localStorage.getItem('user'));
  const token = localStorage.getItem('token');
  const isMentor = user.role === 'MENTOR';
  const { localVideoRef, remoteUsers, joinAsMentor, joinAsStudent, leave } = useAgora();

  useEffect(() => {
    const init = async () => {
      const { data } = await axios.get(`/api/sessions/${sessionId}/token`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (isMentor) {
        await joinAsMentor(data.appId, data.channel, data.token, user.id);
      } else {
        await joinAsStudent(data.appId, data.channel, data.token, user.id);
      }
    };

    init();
    return () => { leave(); };
  }, [sessionId]);

  return (
    <div style={{ display: 'flex', gap: '24px' }}>
      <div style={{ flex: 2 }}>
        {isMentor && <div ref={localVideoRef} style={{ width: '100%', height: '400px', background: '#000' }} />}
        {remoteUsers.map(u => (
          <div key={u.uid} id={`remote-video-${u.uid}`} style={{ width: '100%', height: '400px', background: '#000' }} />
        ))}
      </div>
      <div style={{ flex: 1 }}>
        <QuestionPanel
          sessionId={sessionId}
          userId={user.id}
          userName={user.name}
          isMentor={isMentor}
          token={token}
        />
      </div>
    </div>
  );
}
```

---

## 12. Admin Panel

### Create student account (frontend form)

```jsx
// frontend/src/pages/AdminPanel.jsx
import { useState } from 'react';
import axios from 'axios';

export default function AdminPanel() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('token');

  const createStudent = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/create-student', form, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMsg(`Account created for ${form.email}`);
      setForm({ name: '', email: '', password: '' });
    } catch {
      setMsg('Failed to create account');
    }
  };

  return (
    <div>
      <h2>Create student account</h2>
      {msg && <p>{msg}</p>}
      <form onSubmit={createStudent}>
        <input placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">Create account</button>
      </form>
    </div>
  );
}
```

---

## 13. Environment Variables

### `backend/.env`

```env
DATABASE_URL=postgresql://user:password@localhost:5432/mentordb
JWT_SECRET=your_super_secret_key
PORT=5000
FRONTEND_URL=http://localhost:5173

AGORA_APP_ID=your_agora_app_id
AGORA_APP_CERTIFICATE=your_agora_app_certificate
AGORA_CUSTOMER_KEY=your_agora_customer_key
AGORA_CUSTOMER_SECRET=your_agora_customer_secret

AWS_S3_BUCKET=your-bucket-name
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

### `frontend/.env`

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_AGORA_APP_ID=your_agora_app_id
```

---

## 14. Deployment

### Backend (Render or Railway)

```bash
# Add start script to backend/package.json
"scripts": {
  "start": "node src/app.js",
  "dev": "nodemon src/app.js"
}
```

- Push to GitHub
- Connect repo to [Render.com](https://render.com) or [Railway.app](https://railway.app)
- Set environment variables in the dashboard
- Run `npx prisma migrate deploy` in the build command

### Frontend (Vercel)

```bash
cd frontend
npm run build
# Push to GitHub → connect to vercel.com
# Set VITE_BACKEND_URL to your deployed backend URL
```

### Database (Supabase — free PostgreSQL)

- Create project at [supabase.com](https://supabase.com)
- Copy the connection string into `DATABASE_URL`

---

## 15. API Reference

| Method | Endpoint | Auth | Role | Description |
|--------|----------|------|------|-------------|
| POST | `/api/auth/login` | No | Any | Student/mentor login |
| POST | `/api/auth/create-student` | Yes | MENTOR, ADMIN | Create student account |
| GET | `/api/sessions` | Yes | Any | List all sessions |
| POST | `/api/sessions` | Yes | MENTOR | Create a session |
| GET | `/api/sessions/:id/token` | Yes | Any | Get Agora join token |
| PUT | `/api/sessions/:id/start` | Yes | MENTOR | Mark session as LIVE |
| PUT | `/api/sessions/:id/end` | Yes | MENTOR | Mark session as ENDED |
| GET | `/api/sessions/:id/attendance` | Yes | MENTOR | View who attended |
| POST | `/api/recordings/start` | Yes | MENTOR | Start cloud recording |
| POST | `/api/recordings/stop` | Yes | MENTOR | Stop cloud recording |

---

## Quick Start Summary

```bash
# 1. Clone and install
git clone <your-repo>
cd backend && npm install
cd ../frontend && npm install

# 2. Setup DB
cd backend
npx prisma migrate dev --name init

# 3. Start backend
npm run dev

# 4. Start frontend (new terminal)
cd frontend
npm run dev

# 5. Open browser
# http://localhost:5173
```

---

*Built with Node.js · React · Agora.io · Socket.io · PostgreSQL · Prisma*
