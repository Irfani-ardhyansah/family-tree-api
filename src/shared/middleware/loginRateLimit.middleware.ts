import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';

type AttemptEntry = {
  count: number;
  resetAt: number;
};

const attemptsByIp = new Map<string, AttemptEntry>();

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? req.ip ?? 'unknown';
  }
  return req.ip ?? 'unknown';
}

export function loginRateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const now = Date.now();

  let entry = attemptsByIp.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + env.loginRateLimitWindowMs };
    attemptsByIp.set(ip, entry);
  }

  if (entry.count >= env.loginRateLimitMax) {
    next(new AppError(429, ErrorCodes.TOO_MANY_ATTEMPTS, 'Terlalu banyak percobaan. Coba lagi nanti.'));
    return;
  }

  entry.count += 1;
  next();
}
