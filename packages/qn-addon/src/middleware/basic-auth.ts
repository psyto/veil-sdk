import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({ status: 'error', message: 'Missing or invalid authorization header' });
    return;
  }

  const encoded = authHeader.slice(6);
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  const [username, password] = decoded.split(':');

  if (username !== config.auth.username || password !== config.auth.password) {
    res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    return;
  }

  next();
}
