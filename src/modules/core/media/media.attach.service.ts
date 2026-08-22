import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { MAX_PHOTOS_BY_PURPOSE } from './media.constants';
import { mediaRepository } from './media.repository';
import { isManagedMediaUrl } from './media.storage';
import {
  MediaAttachedToType,
  MediaPurpose,
  MediaRow,
  ResolvedMediaPhotos,
} from './media.types';

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function purposeToAttachedType(purpose: MediaPurpose): MediaAttachedToType {
  if (purpose === 'event') return 'event';
  if (purpose === 'event_contribution') return 'event_contribution';
  if (purpose === 'person') return 'person';
  if (purpose === 'fc_document') return 'fc_document';
  return 'tribute';
}

function assertAttachable(
  row: MediaRow,
  uploaderPersonId: number,
  purpose: MediaPurpose,
): void {
  if (row.status === 'deleted' || row.deleted_at) {
    throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'Media sudah dihapus.');
  }
  if (row.uploader_person_id !== uploaderPersonId) {
    throw new AppError(403, ErrorCodes.MEDIA_ACCESS_FORBIDDEN, 'Media bukan milik Anda.');
  }
  if (row.purpose !== purpose) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'Purpose media tidak cocok dengan entity.',
    );
  }
  if (row.status !== 'pending' && row.status !== 'attached') {
    throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'Status media tidak valid.');
  }
}

function rejectDataUrls(photoUrls: string[]): void {
  for (const url of photoUrls) {
    if (/^data:/i.test(url)) {
      throw new AppError(
        400,
        ErrorCodes.MEDIA_VALIDATION_FAILED,
        'Base64 data URL tidak diizinkan. Upload via POST /media/upload.',
      );
    }
  }
}

/**
 * Resolve `mediaIds` and/or managed `photoUrls` into ordered rows.
 * Does not mutate status — call `attachResolvedMedia` after the entity exists.
 *
 * Legacy: unmanaged http(s) URLs are allowed only when `mediaIds` is empty
 * (seed / demo gallery). Mixing managed + unmanaged is rejected.
 */
export async function resolvePendingPhotos(params: {
  uploaderPersonId: number;
  purpose: MediaPurpose;
  mediaIds?: string[];
  photoUrls?: string[];
  maxCount?: number;
  requireAtLeastOne?: boolean;
  emptyErrorCode?: string;
  emptyErrorMessage?: string;
  /** When true, reject unmanaged URLs (contributions / new FE path). */
  requireManaged?: boolean;
}): Promise<ResolvedMediaPhotos> {
  const maxCount = params.maxCount ?? MAX_PHOTOS_BY_PURPOSE[params.purpose];
  const mediaIds = uniqueStrings(
    (params.mediaIds ?? []).filter((id) => typeof id === 'string' && id.length > 0),
  );
  const photoUrls = uniqueStrings(
    (params.photoUrls ?? []).filter((url) => typeof url === 'string' && url.length > 0),
  );

  rejectDataUrls(photoUrls);

  if (mediaIds.length === 0 && photoUrls.length === 0) {
    if (params.requireAtLeastOne) {
      throw new AppError(
        400,
        params.emptyErrorCode ?? ErrorCodes.MEDIA_VALIDATION_FAILED,
        params.emptyErrorMessage ?? 'Minimal satu foto wajib diisi.',
      );
    }
    return { mediaIds: [], photoUrls: [] };
  }

  const managedUrls = photoUrls.filter((url) => isManagedMediaUrl(url));
  const unmanagedUrls = photoUrls.filter((url) => !isManagedMediaUrl(url));

  if (params.requireManaged && unmanagedUrls.length > 0) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'URL foto harus berasal dari storage FamilyRoots (bukan eksternal / base64).',
    );
  }

  if (mediaIds.length === 0 && managedUrls.length === 0) {
    if (unmanagedUrls.length > maxCount) {
      throw new AppError(
        400,
        ErrorCodes.MEDIA_LIMIT_EXCEEDED,
        `Maksimal ${maxCount} foto untuk purpose ${params.purpose}.`,
      );
    }
    return { mediaIds: [], photoUrls: unmanagedUrls };
  }

  if (unmanagedUrls.length > 0) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'Jangan campur URL eksternal dengan mediaIds / URL storage FamilyRoots.',
    );
  }

  const byId = new Map<string, MediaRow>();
  const byUrl = new Map<string, MediaRow>();

  if (mediaIds.length > 0) {
    const rows = await mediaRepository.findByIds(mediaIds);
    for (const row of rows) {
      byId.set(row.id, row);
    }
  }

  if (managedUrls.length > 0) {
    const rows = await mediaRepository.findByUrls(managedUrls);
    for (const row of rows) {
      byUrl.set(row.url, row);
    }
  }

  const ordered: MediaRow[] = [];

  for (const id of mediaIds) {
    const row = byId.get(id);
    if (!row) {
      throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, `Media ${id} tidak ditemukan.`);
    }
    assertAttachable(row, params.uploaderPersonId, params.purpose);
    ordered.push(row);
  }

  for (const url of managedUrls) {
    const row = byUrl.get(url);
    if (!row) {
      throw new AppError(
        400,
        ErrorCodes.MEDIA_VALIDATION_FAILED,
        'URL foto tidak dikenal di storage FamilyRoots.',
      );
    }
    if (ordered.some((item) => item.id === row.id)) {
      continue;
    }
    assertAttachable(row, params.uploaderPersonId, params.purpose);
    ordered.push(row);
  }

  if (ordered.length > maxCount) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_LIMIT_EXCEEDED,
      `Maksimal ${maxCount} foto untuk purpose ${params.purpose}.`,
    );
  }

  return {
    mediaIds: ordered.map((row) => row.id),
    photoUrls: ordered.map((row) => row.url),
  };
}

export async function attachResolvedMedia(params: {
  mediaIds: string[];
  purpose: MediaPurpose;
  attachedToId: string;
}): Promise<void> {
  if (params.mediaIds.length === 0) {
    return;
  }
  await mediaRepository.attachMany(
    params.mediaIds,
    purposeToAttachedType(params.purpose),
    params.attachedToId,
  );
}
