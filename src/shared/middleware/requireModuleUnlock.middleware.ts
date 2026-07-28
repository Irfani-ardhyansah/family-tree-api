import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';
import { SensitiveModule } from '../../modules/core/auth/secondary-password.constants';
import { tokenService } from '../../modules/core/auth/token.service';

function readUnlockHeader(req: Request): string | null {
  const raw = req.headers['x-module-unlock'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.trim()) {
    return null;
  }
  return value.trim();
}

/**
 * Require valid X-Module-Unlock JWT covering the given module.
 * Must run after requireAuth.
 */
export function requireModuleUnlock(module: SensitiveModule) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (!req.auth) {
        next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.'));
        return;
      }

      const token = readUnlockHeader(req);
      if (!token) {
        next(
          new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_REQUIRED,
            'Verifikasi password kedua diperlukan untuk akses modul ini.',
          ),
        );
        return;
      }

      let payload;
      try {
        payload = tokenService.verifyModuleUnlock(token);
      } catch {
        next(
          new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_INVALID,
            'Token unlock tidak valid atau kedaluwarsa. Verifikasi ulang password kedua.',
          ),
        );
        return;
      }

      if (payload.personId !== req.auth.personId || payload.familyId !== req.auth.familyId) {
        next(
          new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_INVALID,
            'Token unlock tidak cocok dengan sesi saat ini.',
          ),
        );
        return;
      }

      if (!payload.modules.includes(module)) {
        next(
          new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_REQUIRED,
            `Unlock untuk modul ${module} tidak ada di token.`,
          ),
        );
        return;
      }

      req.auth.moduleUnlock = payload.modules;
      next();
    } catch (error) {
      next(error);
    }
  };
}
