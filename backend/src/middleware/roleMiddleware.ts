import { Request, Response, NextFunction } from 'express';
import { Role, JWTPayload } from '../types';

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as Request & { user: JWTPayload }).user;

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({
        error: 'Access forbidden',
        required: roles,
        current: user.role,
      });
      return;
    }

    next();
  };
}
