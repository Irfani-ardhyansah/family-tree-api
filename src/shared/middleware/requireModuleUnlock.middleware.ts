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

      /*
       * Token MCP sudah "trusted": Money Track otomatis, sedangkan core/household
       * hanya kalau dipilih saat membuat token. Tidak perlu X-Module-Unlock di
       * setiap request. Admin tetap tidak bisa lewat token MCP karena route admin
       * memakai requireSessionAuth.
       */
      if (req.auth.authType === 'mcp') {
        const modules = req.auth.mcpUnlockModules ?? [];
        if (!modules.includes(module)) {
          next(
            new AppError(
              403,
              ErrorCodes.SECONDARY_UNLOCK_REQUIRED,
              `Token MCP ini tidak punya akses modul ${module}. Buat token baru dengan unlock modul tersebut.`,
            ),
          );
          return;
        }

        req.auth.moduleUnlock = modules;
        next();
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
