import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

type JwtPayload = {
  sub?: string;
  email?: string;
};

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: 'Missing Authorization header' });

  const [, token] = header.split(' ');
  if (!token) return res.status(401).json({ message: 'Invalid Authorization header' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ message: 'JWT_SECRET is not configured' });

  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    (req as any).userId = decoded.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}
