import redis from '../config/redis';

const SESSION_TTL = 3600;       // 1 hour
const RATE_LIMIT_WINDOW = 60;   // 60 seconds

// ── Session Cache ──────────────────────────────────────────────────────────

export async function cacheSession(sessionId: string, data: object): Promise<void> {
  await redis.set(
    `session:${sessionId}`,
    JSON.stringify(data),
    'EX',
    SESSION_TTL
  );
}

export async function getCachedSession<T>(sessionId: string): Promise<T | null> {
  const raw = await redis.get(`session:${sessionId}`);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await redis.del(`session:${sessionId}`);
}

// ── Online Presence (Redis Set per session room) ───────────────────────────

export async function addUserToRoom(sessionId: string, userId: string): Promise<void> {
  await redis.sadd(`presence:${sessionId}`, userId);
  await redis.expire(`presence:${sessionId}`, SESSION_TTL);
}

export async function removeUserFromRoom(sessionId: string, userId: string): Promise<void> {
  await redis.srem(`presence:${sessionId}`, userId);
}

export async function getOnlineUsers(sessionId: string): Promise<string[]> {
  return redis.smembers(`presence:${sessionId}`);
}

export async function getOnlineCount(sessionId: string): Promise<number> {
  return redis.scard(`presence:${sessionId}`);
}

export async function clearRoomPresence(sessionId: string): Promise<void> {
  await redis.del(`presence:${sessionId}`);
}

// ── JWT Blacklist ──────────────────────────────────────────────────────────

export async function blacklistToken(token: string, expirySeconds: number): Promise<void> {
  await redis.set(`blacklist:${token}`, '1', 'EX', expirySeconds);
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const val = await redis.get(`blacklist:${token}`);
  return val !== null;
}

// ── Sliding Window Rate Limiter ────────────────────────────────────────────

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number = RATE_LIMIT_WINDOW
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const redisKey = `ratelimit:${key}`;
  const now = Date.now();
  const windowMs = windowSecs * 1000;

  // Remove old entries
  await redis.zremrangebyscore(redisKey, 0, now - windowMs);

  // Count current requests
  const count = await redis.zcard(redisKey);

  if (count >= limit) {
    const oldest = await redis.zrange(redisKey, 0, 0, 'WITHSCORES');
    const oldestTime = oldest.length > 1 ? parseInt(oldest[1]) : now;
    const resetIn = Math.ceil((oldestTime + windowMs - now) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Add current request
  await redis.zadd(redisKey, now, `${now}-${Math.random()}`);
  await redis.expire(redisKey, windowSecs);

  return { allowed: true, remaining: limit - count - 1, resetIn: 0 };
}

// ── General Key/Value Cache ────────────────────────────────────────────────

export async function setCache(key: string, value: unknown, ttl: number): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttl);
}

export async function getCache<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function deleteCache(key: string): Promise<void> {
  await redis.del(key);
}
