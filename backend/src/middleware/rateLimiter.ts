import { Request, Response, NextFunction } from 'express';
import { checkRateLimit } from '../services/redisService';

interface RateLimiterOptions {
  limit?: number;
  windowSecs?: number;
  keyFn?: (req: Request) => string;
}

/**
 * Redis-backed sliding window rate limiter middleware.
 */
export function rateLimiter(options: RateLimiterOptions = {}) {
  const { limit = 20, windowSecs = 60, keyFn } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = keyFn ? keyFn(req) : `${ip}:${req.path}`;

    try {
      const result = await checkRateLimit(key, limit, windowSecs);

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);

      if (!result.allowed) {
        res.setHeader('Retry-After', result.resetIn);
        res.status(429).json({
          error: 'Too many requests',
          retryAfter: result.resetIn,
        });
        return;
      }

      next();
    } catch {
      // Redis failure → fail open (allow request)
      next();
    }
  };
}

// Preset: strict for auth endpoints
export const authRateLimiter = rateLimiter({ limit: 10, windowSecs: 60 });

// Preset: lenient for general API
export const apiRateLimiter = rateLimiter({ limit: 100, windowSecs: 60 });
