import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { authRepository } from '../auth/auth.repository';
import { personOptionsService } from '../person-options/person-options.service';
import {
  buildReadFocusMeta,
  parseFocusPersonIdParam,
} from './read-focus.service';
import { personsRepository } from './persons.repository';

async function resolveFocusPersonId(req: Request): Promise<number | undefined> {
  const fromQuery = parseFocusPersonIdParam(req.query.focusPersonId);
  if (fromQuery !== undefined) {
    return fromQuery;
  }

  if (!req.auth) {
    return undefined;
  }

  const spouseIds = await authRepository.findSpouseIdsByPersonId(req.auth.personId);
  return personOptionsService.resolveStoredReadFocusPersonId(req.auth.personId, spouseIds);
}

/** Resolve read focus: query override → person_options → default user login. */
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

      const focusPersonId = await resolveFocusPersonId(req);

      if (focusPersonId !== undefined) {
        const exists = await personsRepository.findById(req.auth.familyId, focusPersonId);
        if (!exists) {
          next(new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.'));
          return;
        }
      }

      const spouseIds = await authRepository.findSpouseIdsByPersonId(req.auth.personId);
      req.readFocus = buildReadFocusMeta(req.auth.personId, spouseIds, focusPersonId);
      next();
    } catch (error) {
      next(error);
    }
  })();
}

/** @deprecated Alias — sama dengan resolveReadFocusMiddleware (focusPersonId query opsional). */
export const requireReadFocusMiddleware = resolveReadFocusMiddleware;
