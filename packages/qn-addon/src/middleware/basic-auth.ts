import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config';

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against self to maintain constant time, then return false
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid authorization header' });
    return;
  }

  const encoded = authHeader.slice(6);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    return;
  }

  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  const usernameMatch = timingSafeEqual(username, config.auth.username);
  const passwordMatch = timingSafeEqual(password, config.auth.password);

  if (!usernameMatch || !passwordMatch) {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    return;
  }

  next();
}
