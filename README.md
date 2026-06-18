# MentorStream – Mentor Dashboard

> Full-stack live streaming platform: TypeScript · React · Tailwind · Redux Toolkit · PostgreSQL · Redis · LiveKit · MinIO · Docker

---

## 🚀 Quick Start

```bash
# 1. Clone and enter the project
cd LiveStreamPlatform

# 2. Start all 6 Docker services
docker compose up --build

# 3. (First run only) Seed the database with demo accounts
docker exec mentor_backend npm run seed
```

Then open **http://localhost:5173** in your browser.

---

## 🔑 Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| **Admin** | admin@mentorstream.local | admin123 |
| **Mentor** | mentor@mentorstream.local | mentor123 |
| **Student** | alice@mentorstream.local | student123 |

---

## 🐳 Docker Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | React + Vite UI |
| **Backend API** | http://localhost:5000/api/health | Express + TypeScript API |
| **LiveKit** | ws://localhost:7880 | Free WebRTC video server |
| **MinIO** | http://localhost:9000 | Free S3-compatible storage |
| **MinIO Console** | http://localhost:9001 | Storage browser (minioadmin/minioadmin123) |
| **PostgreSQL** | localhost:5432 | Database (mentor/mentor_pass_2024) |
| **Redis** | localhost:6379 | Cache & presence |

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS v3 (dark mode, glass morphism) |
| State | Redux Toolkit (auth, sessions, questions) |
| Backend | Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis (sessions, presence, rate limiting, JWT blacklist) |
| Video | **LiveKit** (free, self-hosted – replaces Agora) |
| Storage | **MinIO** (free, self-hosted S3 – replaces AWS S3) |
| Real-time | Socket.io (Q&A, attendance) |
| Auth | JWT with Redis blacklisting |

---

## 📁 Project Structure

```
LiveStreamPlatform/
├── docker-compose.yml      # All 6 services
├── livekit/
│   └── livekit.yaml        # LiveKit server config
├── backend/
│   ├── Dockerfile
│   └── src/
│       ├── app.ts           # Express entry point
│       ├── config/          # Redis + Prisma clients
│       ├── controllers/     # Auth, Session, Question, Recording
│       ├── middleware/       # JWT auth, Role guard, Rate limiter
│       ├── routes/          # REST API routes
│       ├── services/        # LiveKit token, Redis helpers, MinIO
│       ├── socket/          # Socket.io real-time handler
│       ├── types/           # TypeScript interfaces
│       └── prisma/          # Schema + seed
└── frontend/
    ├── Dockerfile
    └── src/
        ├── App.tsx          # Routes
        ├── store/           # Redux (auth, sessions, questions)
        ├── hooks/           # useLiveKit, useSocket
        ├── services/        # Axios with JWT interceptor
        ├── components/      # VideoPlayer, QuestionPanel, etc.
        └── pages/           # Login, Mentor/StudentDashboard, LiveSession, AdminPanel
```

---

## 🎮 How to Use

### Mentor Flow
1. Login as mentor → **Mentor Dashboard**
2. Click **New Session** → fill in title + schedule time → Create
3. Click **Start** on a session to go LIVE
4. Join the session → camera/mic/screen share controls appear
5. See Q&A panel on the right, mark questions as answered
6. Click **End Session** when done

### Student Flow
1. Login as student → **Student Dashboard**
2. See the live session banner if a session is active → click **Join**
3. Watch the mentor's stream
4. Type questions in the Q&A panel (bottom of right sidebar)
5. See your questions get marked as answered in real time

### Admin Flow
1. Login as admin → **Mentor Dashboard** (or Admin Panel via navbar)
2. Go to **Admin Panel** to create/delete student accounts
3. Full session management like mentor

---

## 🔌 API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | ❌ | Login |
| POST | `/api/auth/logout` | ✅ | Logout (blacklists token) |
| GET | `/api/auth/me` | ✅ | Current user |
| POST | `/api/auth/create-student` | MENTOR+ | Create student |
| GET | `/api/auth/students` | MENTOR+ | List students |
| GET | `/api/sessions` | ✅ | List all sessions |
| POST | `/api/sessions` | MENTOR+ | Create session |
| GET | `/api/sessions/:id/token` | ✅ | Get LiveKit token |
| PUT | `/api/sessions/:id/start` | MENTOR+ | Mark as LIVE |
| PUT | `/api/sessions/:id/end` | MENTOR+ | Mark as ENDED |
| GET | `/api/sessions/:id/attendance` | MENTOR+ | Attendance list |
| GET | `/api/recordings` | ✅ | All recordings |

---

## ⚙️ Redis Usage

| Purpose | Key Pattern | TTL |
|---------|-------------|-----|
| Session cache | `session:{id}` | 1 hour |
| Online presence | `presence:{sessionId}` | 1 hour |
| Rate limiting | `ratelimit:{ip}:{path}` | 60s |
| JWT blacklist | `blacklist:{token}` | 7 days |

---

## 🛠️ Development Commands

```bash
# Start all services
docker compose up

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Seed demo data
docker exec mentor_backend npm run seed

# Prisma studio (database browser)
docker exec mentor_backend npm run prisma:studio

# Run migrations manually
docker exec mentor_backend npx prisma migrate deploy

# Restart a single service
docker compose restart backend
```

---

*Built with ❤️ using LiveKit · MinIO · PostgreSQL · Redis · TypeScript · Tailwind CSS*
