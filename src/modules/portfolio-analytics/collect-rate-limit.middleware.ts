import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { getClientIp } from '../../shared/utils/client-ip';

type WindowEntry = {
  reqs: number;
  events: number;
  resetAt: number;
};

const windows = new Map<string, WindowEntry>();

export function collectRateLimitMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const ip = getClientIp(req) ?? 'unknown';
  const now = Date.now();
  const events = Array.isArray((req.body as { events?: unknown } | undefined)?.events)
    ? ((req.body as { events: unknown[] }).events.length)
    : 1;

  let entry = windows.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { reqs: 0, events: 0, resetAt: now + env.analytics.collectRateLimitWindowMs };
    windows.set(ip, entry);
  }

  if (
    entry.reqs >= env.analytics.collectRateLimitMax ||
    entry.events + events > env.analytics.collectEventsPerMinuteMax
  ) {
    next(new AppError(429, ErrorCodes.TOO_MANY_ATTEMPTS, 'Terlalu banyak event analytics. Coba lagi nanti.'));
    return;
  }

  entry.reqs += 1;
  entry.events += events;
  if (entry.reqs > env.analytics.botCollectPerMinute) {
    req.analyticsForceBot = true;
  }

  next();
}
