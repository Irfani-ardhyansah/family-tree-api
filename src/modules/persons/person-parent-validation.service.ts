import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';

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
