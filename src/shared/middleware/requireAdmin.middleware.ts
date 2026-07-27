import { NextFunction, Request, Response } from 'express';
import db from '../../config/database';
import { AppError } from '../errors/AppError';
import { ErrorCodes } from '../errors/errorCodes';
import { Tables } from '../database/tables';

async function resolveFamilyRole(
  familyId: number,
  personId: number,
): Promise<'admin' | 'member'> {
  const row = await db(Tables.FAMILY_MEMBERS)
    .where({ family_id: familyId, person_id: personId })
    .first<{ role: 'admin' | 'member' }>('role');

  return row?.role === 'admin' ? 'admin' : 'member';
}

/** Require authenticated family admin. Must run after requireAuth. */
export async function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.auth) {
      next(new AppError(401, ErrorCodes.UNAUTHORIZED, 'Autentikasi diperlukan.'));
      return;
    }

    const role = await resolveFamilyRole(req.auth.familyId, req.auth.personId);
    req.auth.role = role;
    req.auth.isAdmin = role === 'admin';

    if (role !== 'admin') {
      next(new AppError(403, ErrorCodes.FORBIDDEN, 'Akses admin diperlukan.'));
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
