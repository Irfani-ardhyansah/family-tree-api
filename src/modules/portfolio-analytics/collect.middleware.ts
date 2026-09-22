import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { bearerToken, safeEqual } from './analytics-crypto';

function allowedAnalyticsOrigins(): string[] {
  if (env.analytics.corsOrigins.length > 0) {
    return env.analytics.corsOrigins;
  }
  return env.corsOrigins.filter((origin) => origin !== '*');
}

export function requireAnalyticsOrigin(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowed = allowedAnalyticsOrigins();
  const allowAny = !env.isProduction && (env.corsOrigins.includes('*') || allowed.length === 0);

  if (!origin) {
    if (env.isProduction) {
      next(new AppError(403, ErrorCodes.CORS_FORBIDDEN, 'Origin tidak diizinkan.'));
      return;
    }
    next();
    return;
  }

  if (allowAny || allowed.includes(origin)) {
    next();
    return;
  }

  next(new AppError(403, ErrorCodes.CORS_FORBIDDEN, 'Origin tidak diizinkan.'));
}

export function collectBodyLimit(req: Request, _res: Response, next: NextFunction): void {
  const declared = Number(req.headers['content-length'] ?? 0);
  if (declared > env.analytics.collectMaxBytes) {
    next(
      new AppError(
        413,
        ErrorCodes.ANALYTICS_PAYLOAD_TOO_LARGE,
        'Payload analytics melebihi 32 KB.',
      ),
    );
    return;
  }

  if (req.body && declared === 0) {
    const size = Buffer.byteLength(JSON.stringify(req.body));
    if (size > env.analytics.collectMaxBytes) {
      next(
        new AppError(
          413,
          ErrorCodes.ANALYTICS_PAYLOAD_TOO_LARGE,
          'Payload analytics melebihi 32 KB.',
        ),
      );
      return;
    }
  }

  next();
}

export function optionalAnalyticsWriteKey(req: Request, _res: Response, next: NextFunction): void {
  const token = bearerToken(req.headers.authorization);
  if (!token) {
    next();
    return;
  }

  const { writeKey } = env.analytics;
  if (!writeKey) {
    next();
    return;
  }

  if (!safeEqual(token, writeKey)) {
    next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Write key tidak valid.'));
    return;
  }

  next();
}
