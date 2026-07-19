import { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';
import { tokenService } from '../../modules/auth/token.service';

/** Require valid Bearer JWT; sets req.auth.personId + req.auth.familyId */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.'));
    return;
  }

  try {
    const token = header.slice('Bearer '.length).trim();
    const payload = tokenService.verifyAccessToken(token);
    req.auth = {
      personId: payload.personId,
      familyId: payload.familyId,
    };
    next();
  } catch {
    next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Token tidak valid atau kedaluwarsa.'));
  }
}

export { optionalAuth } from './optionalAuth.middleware';
