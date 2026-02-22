/**
 * HTTP request logger middleware.
 *
 * Logs:  route · method · timestamp · userId (if authenticated)
 * Never logs:  passwords · raw tokens · sensitive request bodies
 */

import { Request, Response, NextFunction } from 'express';

/* ------------------------------------------------------------------ */
/*  Structured logger                                                 */
/* ------------------------------------------------------------------ */

const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'currentPassword',
  'token',
  'authorization',
  'cookie',
  'secret',
]);

function sanitizeBody(body: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
  }
  return sanitized;
}

export const logger = {
  info(data: Record<string, unknown>): void {
    console.log(
      JSON.stringify({ level: 'info', timestamp: new Date().toISOString(), ...data }),
    );
  },
  warn(data: Record<string, unknown>): void {
    console.warn(
      JSON.stringify({ level: 'warn', timestamp: new Date().toISOString(), ...data }),
    );
  },
  error(data: Record<string, unknown>): void {
    console.error(
      JSON.stringify({ level: 'error', timestamp: new Date().toISOString(), ...data }),
    );
  },
};

/* ------------------------------------------------------------------ */
/*  Express middleware                                                 */
/* ------------------------------------------------------------------ */

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = (req as any).user?._id?.toString() ?? null;

    const logEntry: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId,
      ip: req.ip,
    };

    // Only log body for non-GET requests, and always sanitize
    if (req.method !== 'GET' && req.body && Object.keys(req.body).length > 0) {
      logEntry.body = sanitizeBody(req.body);
    }

    if (res.statusCode >= 400) {
      logger.warn(logEntry);
    } else {
      logger.info(logEntry);
    }
  });

  next();
}
