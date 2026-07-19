import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError, isAppError } from './AppError';
import { ErrorCodes } from './errorCodes';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCodes.NOT_FOUND, 'Endpoint tidak ditemukan.'));
}

function isJsonSyntaxError(err: unknown): err is SyntaxError & { status?: number; body?: unknown } {
  return err instanceof SyntaxError && 'body' in err;
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isAppError(err)) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
      },
    });
    return;
  }

  if (isJsonSyntaxError(err)) {
    res.status(400).json({
      error: {
        code: ErrorCodes.INVALID_JSON,
        message: 'Body JSON tidak valid.',
      },
    });
    return;
  }

  if (err instanceof Error && err.message.startsWith('Origin not allowed')) {
    res.status(403).json({
      error: {
        code: ErrorCodes.CORS_FORBIDDEN,
        message: 'Origin tidak diizinkan.',
      },
    });
    return;
  }

  if (!env.isProduction) {
    console.error('[error]', req.method, req.path, err);
  }

  res.status(500).json({
    error: {
      code: ErrorCodes.INTERNAL_ERROR,
      message: 'Terjadi kesalahan pada server.',
    },
  });
}
