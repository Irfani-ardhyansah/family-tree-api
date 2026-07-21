import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { authRepository } from '../auth/auth.repository';
import {
  buildReadFocusMeta,
  parseFocusPersonIdParam,
} from './read-focus.service';
import { personsRepository } from './persons.repository';

/** Resolve `?focusPersonId=` for all GET /persons read endpoints. */
export function resolveReadFocusMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  void (async () => {
    try {
      if (!req.auth) {
        next();
        return;
      }

      const focusPersonIdParam = parseFocusPersonIdParam(req.query.focusPersonId);

      if (focusPersonIdParam !== undefined) {
        const exists = await personsRepository.findById(req.auth.familyId, focusPersonIdParam);
        if (!exists) {
          next(new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.'));
          return;
        }
      }

      const spouseIds = await authRepository.findSpouseIdsByPersonId(req.auth.personId);
      req.readFocus = buildReadFocusMeta(req.auth.personId, spouseIds, focusPersonIdParam);
      next();
    } catch (error) {
      next(error);
    }
  })();
}
