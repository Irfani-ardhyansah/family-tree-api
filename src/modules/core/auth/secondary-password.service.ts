import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { hashPassword, verifyPassword } from './password-hash';
import { SENSITIVE_MODULES } from './secondary-password.constants';
import { secondaryPasswordRepository } from './secondary-password.repository';
import { tokenService } from './token.service';
import { SecondaryPasswordStatus } from './auth.types';

const MIN_LEN = 6;
const MAX_LEN = 72;

function parsePassword(raw: unknown, field = 'password'): string {
  if (typeof raw !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} wajib diisi.`);
  }
  const password = raw.trim();
  if (password.length < MIN_LEN) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} minimal ${MIN_LEN} karakter.`,
    );
  }
  if (password.length > MAX_LEN) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${MAX_LEN} karakter.`,
    );
  }
  return password;
}

export class SecondaryPasswordService {
  async getStatus(personId: number): Promise<SecondaryPasswordStatus> {
    const isSet = await secondaryPasswordRepository.isSet(personId);
    return {
      isSet,
      mustSetup: !isSet,
      unlocks: [...SENSITIVE_MODULES],
    };
  }

  async setup(
    personId: number,
    familyId: number,
    body: unknown,
  ): Promise<{
    secondaryPassword: SecondaryPasswordStatus;
    unlockToken: string;
    expiresIn: number;
  }> {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const password = parsePassword(record.password);
    const confirm = parsePassword(record.confirmPassword, 'confirmPassword');

    if (password !== confirm) {
      throw new AppError(
        422,
        ErrorCodes.SECONDARY_PASSWORD_MISMATCH,
        'Konfirmasi password tidak cocok.',
      );
    }

    if (await secondaryPasswordRepository.isSet(personId)) {
      throw new AppError(
        409,
        ErrorCodes.SECONDARY_PASSWORD_ALREADY_SET,
        'Password kedua sudah diatur. Gunakan endpoint change untuk mengganti.',
      );
    }

    const passwordHash = await hashPassword(password);
    await secondaryPasswordRepository.insert(personId, passwordHash);

    const unlock = tokenService.signModuleUnlock(personId, familyId);
    return {
      secondaryPassword: {
        isSet: true,
        mustSetup: false,
        unlocks: [...SENSITIVE_MODULES],
      },
      unlockToken: unlock.unlockToken,
      expiresIn: unlock.expiresIn,
    };
  }

  async verify(
    personId: number,
    familyId: number,
    body: unknown,
  ): Promise<{ unlockToken: string; expiresIn: number; modules: string[] }> {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const password = parsePassword(record.password);

    const row = await secondaryPasswordRepository.findByPersonId(personId);
    if (!row) {
      throw new AppError(
        409,
        ErrorCodes.SECONDARY_PASSWORD_NOT_SET,
        'Password kedua belum diatur. Lakukan setup terlebih dahulu.',
      );
    }

    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      throw new AppError(
        401,
        ErrorCodes.SECONDARY_PASSWORD_INVALID,
        'Password kedua salah.',
      );
    }

    const unlock = tokenService.signModuleUnlock(personId, familyId);
    return {
      unlockToken: unlock.unlockToken,
      expiresIn: unlock.expiresIn,
      modules: [...SENSITIVE_MODULES],
    };
  }

  async change(personId: number, body: unknown): Promise<{ changed: true }> {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const currentPassword = parsePassword(record.currentPassword, 'currentPassword');
    const newPassword = parsePassword(record.newPassword, 'newPassword');
    const confirm = parsePassword(record.confirmPassword, 'confirmPassword');

    if (newPassword !== confirm) {
      throw new AppError(
        422,
        ErrorCodes.SECONDARY_PASSWORD_MISMATCH,
        'Konfirmasi password baru tidak cocok.',
      );
    }

    const row = await secondaryPasswordRepository.findByPersonId(personId);
    if (!row) {
      throw new AppError(
        409,
        ErrorCodes.SECONDARY_PASSWORD_NOT_SET,
        'Password kedua belum diatur.',
      );
    }

    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) {
      throw new AppError(
        401,
        ErrorCodes.SECONDARY_PASSWORD_INVALID,
        'Password kedua saat ini salah.',
      );
    }

    await secondaryPasswordRepository.updateHash(personId, await hashPassword(newPassword));
    return { changed: true };
  }
}

export const secondaryPasswordService = new SecondaryPasswordService();
