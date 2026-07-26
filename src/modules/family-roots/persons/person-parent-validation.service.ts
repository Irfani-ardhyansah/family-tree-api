import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';

/** ISO `YYYY-MM-DD` — parent must be strictly older than child. */
export function assertParentBornBeforeChild(
  childBirthDate: string,
  parentBirthDate: string,
  parentRole: 'ayah' | 'ibu',
): void {
  if (parentBirthDate >= childBirthDate) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      parentRole === 'ayah'
        ? 'Tanggal lahir ayah harus sebelum tanggal lahir person.'
        : 'Tanggal lahir ibu harus sebelum tanggal lahir person.',
    );
  }
}

/** Ayah harus laki-laki; ibu harus perempuan. */
export function assertParentGender(
  parentGender: 'male' | 'female',
  parentRole: 'ayah' | 'ibu',
): void {
  if (parentRole === 'ayah' && parentGender !== 'male') {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      'Ayah harus berjenis kelamin laki-laki.',
    );
  }
  if (parentRole === 'ibu' && parentGender !== 'female') {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      'Ibu harus berjenis kelamin perempuan.',
    );
  }
}

/** Parse optional parent id: omit/null → null; otherwise positive integer. */
export function parseOptionalParentId(
  value: unknown,
  parentRole: 'ayah' | 'ibu',
): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      parentRole === 'ayah' ? 'Ayah tidak valid.' : 'Ibu tidak valid.',
    );
  }
  return value;
}
