import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  // Log full stack trace with request ID for correlation
  const reqId = req.requestId || '-';
  console.error(`[${reqId}] Unhandled error:`, err.stack || err.message || err);

  // Return sanitized message to client
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: isProduction ? 'Internal server error' : (err.message || 'Internal server error'),
  });
}
