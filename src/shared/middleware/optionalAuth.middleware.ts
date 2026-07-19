import { NextFunction, Request, Response } from 'express';
import { tokenService } from '../../modules/auth/token.service';

/**
 * Attach req.auth when Bearer token is valid; continue as guest otherwise.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  try {
    const token = header.slice('Bearer '.length).trim();
    const payload = tokenService.verifyAccessToken(token);
    req.auth = {
      personId: payload.personId,
      familyId: payload.familyId,
    };
  } catch {
    // Ignore invalid token on public/optional routes
  }

  next();
}
