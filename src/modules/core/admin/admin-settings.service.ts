import { randomBytes } from 'crypto';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { MIME_TO_EXT, ALLOWED_MIME_TYPES } from '../media/media.constants';
import { buildPublicUrl, mediaStorage } from '../media/media.storage';
import { adminAuditService } from './admin-audit.service';
import { adminSettingsRepository } from './admin-settings.repository';
import { AdminSettings } from './admin.types';

const DEFAULT_TIMEZONE = 'Asia/Jakarta';
const DEFAULT_CURRENCY = 'IDR';

function toSettings(row: {
  name: string;
  timezone: string;
  currency: string;
  logo_url: string | null;
}): AdminSettings {
  return {
    familyName: row.name,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    currency: row.currency || DEFAULT_CURRENCY,
    logoUrl: row.logo_url,
  };
}

export class AdminSettingsService {
  async get(familyId: number): Promise<AdminSettings> {
    const row = await adminSettingsRepository.getFamily(familyId);
    if (!row) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Keluarga tidak ditemukan.');
    }
    return toSettings(row);
  }

  async update(
    familyId: number,
    personId: number,
    body: Record<string, unknown>,
  ): Promise<AdminSettings> {
    const current = await adminSettingsRepository.getFamily(familyId);
    if (!current) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Keluarga tidak ditemukan.');
    }

    const familyName =
      typeof body.familyName === 'string' ? body.familyName.trim() : current.name;
    const timezone =
      typeof body.timezone === 'string' && body.timezone.trim()
        ? body.timezone.trim()
        : current.timezone || DEFAULT_TIMEZONE;
    const currency =
      typeof body.currency === 'string' && body.currency.trim()
        ? body.currency.trim().toUpperCase()
        : current.currency || DEFAULT_CURRENCY;

    let logoUrl = current.logo_url;
    if (body.logoUrl === null) {
      logoUrl = null;
    } else if (typeof body.logoUrl === 'string') {
      logoUrl = body.logoUrl.trim() || null;
    }

    if (!familyName) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'familyName wajib diisi.',
      );
    }
    if (familyName.length > 255) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'familyName maksimal 255 karakter.',
      );
    }
    if (timezone.length > 64) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'timezone tidak valid.',
      );
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'currency harus kode 3 huruf (contoh: IDR).',
      );
    }

    const before = toSettings(current);
    await adminSettingsRepository.updateSettings({
      familyId,
      familyName,
      timezone,
      currency,
      logoUrl,
    });

    const updated = await this.get(familyId);

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'settings',
      summary: 'Pengaturan keluarga diperbarui',
      before,
      after: updated,
    });

    return updated;
  }

  async uploadLogo(
    familyId: number,
    personId: number,
    file?: Express.Multer.File,
  ): Promise<{ logoUrl: string }> {
    if (!file?.buffer) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'File logo wajib diunggah (field file).',
      );
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'Format harus image/jpeg, image/png, image/webp, atau image/gif.',
      );
    }

    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new AppError(
        422,
        ErrorCodes.ADMIN_SETTINGS_VALIDATION_FAILED,
        'Format gambar tidak didukung.',
      );
    }

    const current = await adminSettingsRepository.getFamily(familyId);
    if (!current) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Keluarga tidak ditemukan.');
    }

    const storageKey = `family/${familyId}/logo-${randomBytes(8).toString('hex')}.${ext}`;
    await mediaStorage.save(storageKey, file.buffer);
    const logoUrl = buildPublicUrl(storageKey);

    await adminSettingsRepository.updateLogoUrl(familyId, logoUrl);

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'settings',
      summary: 'Logo keluarga diperbarui',
      before: { logoUrl: current.logo_url },
      after: { logoUrl },
    });

    return { logoUrl };
  }
}

export const adminSettingsService = new AdminSettingsService();
