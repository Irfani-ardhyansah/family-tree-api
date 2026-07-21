import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { ReadFocusMeta } from './persons.types';

export function getAllowedReadFocusPersonIds(viewerId: number, spouseIds: number[]): number[] {
  return [viewerId, ...spouseIds.filter((id) => id !== viewerId)];
}

/** Default fokus baca = user login (diri sendiri). */
export function resolveReadFocusPersonId(
  viewerId: number,
  spouseIds: number[],
  focusPersonId?: number,
): number {
  if (focusPersonId === undefined) {
    return viewerId;
  }

  const allowed = getAllowedReadFocusPersonIds(viewerId, spouseIds);
  if (!allowed.includes(focusPersonId)) {
    throw new AppError(
      403,
      ErrorCodes.PERSON_READ_FOCUS_FORBIDDEN,
      'focusPersonId hanya boleh diri sendiri atau pasangan yang terdaftar.',
    );
  }

  return focusPersonId;
}

export function parseFocusPersonIdParam(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }

  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      'Parameter focusPersonId tidak valid.',
    );
  }

  return value;
}

export function buildReadFocusMeta(
  viewerId: number,
  spouseIds: number[],
  focusPersonIdParam?: number,
): ReadFocusMeta {
  return {
    focusPersonId: resolveReadFocusPersonId(viewerId, spouseIds, focusPersonIdParam),
    allowedFocusPersonIds: getAllowedReadFocusPersonIds(viewerId, spouseIds),
  };
}
