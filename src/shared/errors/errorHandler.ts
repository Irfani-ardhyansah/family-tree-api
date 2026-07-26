import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { reportUnexpectedError } from '../logging/reportError';
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
    if (err.statusCode >= 500) {
      void reportUnexpectedError(err, req, { code: err.code, operational: true });
    }
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        requestId: req.requestId ?? null,
      },
    });
    return;
  }

  if (isJsonSyntaxError(err)) {
    res.status(400).json({
      error: {
        code: ErrorCodes.INVALID_JSON,
        message: 'Body JSON tidak valid.',
        requestId: req.requestId ?? null,
      },
    });
    return;
  }

  if (err instanceof Error && err.message.startsWith('Origin not allowed')) {
    res.status(403).json({
      error: {
        code: ErrorCodes.CORS_FORBIDDEN,
        message: 'Origin tidak diizinkan.',
        requestId: req.requestId ?? null,
      },
    });
    return;
  }

  void reportUnexpectedError(err, req).then((reported) => {
    if (!env.isProduction) {
      console.error('[error]', req.method, req.path, err);
    }

    res.status(500).json({
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Terjadi kesalahan pada server.',
        requestId: reported.requestId,
        // Dev-only: bantu debug tanpa buka DB/file dulu
        ...(!env.isProduction
          ? {
              debug: {
                name: reported.name,
                message: reported.message,
                file: reported.file,
                line: reported.line,
                column: reported.column,
              },
            }
          : {}),
      },
    });
  }).catch(() => {
    res.status(500).json({
      error: {
        code: ErrorCodes.INTERNAL_ERROR,
        message: 'Terjadi kesalahan pada server.',
        requestId: req.requestId ?? null,
      },
    });
  });
}
