import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { canAccessEvent } from '../../family-roots/events/event-access.service';
import { eventsRepository } from '../../family-roots/events/events.repository';
import {
  canAccessMemorial,
} from '../../family-roots/memoriam/memoriam-access.service';
import { personsRepository } from '../../family-roots/persons/persons.repository';
import {
  ALLOWED_MIME_TYPES,
  MEDIA_PURPOSES,
  MIME_TO_EXT,
  buildStorageKey,
} from './media.constants';
import { createMediaId } from './media.id';
import { mediaRepository } from './media.repository';
import { buildPublicUrl, mediaStorage } from './media.storage';
import {
  MediaCleanupResult,
  MediaItem,
  MediaPurpose,
  MediaRow,
} from './media.types';

function mapMediaRow(row: MediaRow): MediaItem {
  const createdAt =
    row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
  return {
    id: row.id,
    url: row.url,
    purpose: row.purpose,
    status: row.status,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    createdAt,
  };
}

function parsePurpose(raw: unknown): MediaPurpose {
  if (typeof raw !== 'string' || !MEDIA_PURPOSES.includes(raw as MediaPurpose)) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'purpose harus event | event_contribution | memoriam_tribute | person.',
    );
  }
  return raw as MediaPurpose;
}

function parseContextId(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return String(raw);
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) {
    return raw.trim();
  }
  throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'contextId tidak valid.');
}

function parseMediaIds(body: unknown): string[] {
  if (!body || typeof body !== 'object') {
    throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'Body cleanup tidak valid.');
  }
  const mediaIds = (body as Record<string, unknown>).mediaIds;
  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'mediaIds wajib berupa array tidak kosong.',
    );
  }
  const ids = mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (ids.length === 0) {
    throw new AppError(
      400,
      ErrorCodes.MEDIA_VALIDATION_FAILED,
      'mediaIds wajib berupa array tidak kosong.',
    );
  }
  return [...new Set(ids)];
}

export class MediaService {
  private async assertUploadAccess(
    familyId: number,
    viewerId: number,
    purpose: MediaPurpose,
    contextId: string | null,
  ): Promise<void> {
    if (!contextId) {
      return;
    }

    const numericId = Number(contextId);
    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'contextId tidak valid.');
    }

    if (purpose === 'person') {
      const person = await personsRepository.findById(familyId, numericId);
      if (!person) {
        throw new AppError(
          400,
          ErrorCodes.MEDIA_VALIDATION_FAILED,
          'contextId harus personId yang valid dalam keluarga.',
        );
      }
      return;
    }

    if (purpose === 'memoriam_tribute') {
      const person = await personsRepository.findById(familyId, numericId);
      if (!person || person.status !== 'deceased') {
        throw new AppError(
          400,
          ErrorCodes.MEDIA_VALIDATION_FAILED,
          'contextId harus deceasedId yang valid.',
        );
      }
      const graph = await personsRepository.findGraphNodes(familyId);
      if (!canAccessMemorial(viewerId, numericId, graph)) {
        throw new AppError(
          403,
          ErrorCodes.MEDIA_ACCESS_FORBIDDEN,
          'Anda tidak terhubung dengan mendiang ini.',
        );
      }
      return;
    }

    // event / event_contribution — contextId = eventId
    const event = await eventsRepository.findById(familyId, numericId);
    if (!event) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }
    const attendeeMap = await eventsRepository.findAttendeeIdsByEventIds([numericId]);
    const attendeeIds = attendeeMap.get(numericId) ?? [];
    if (!canAccessEvent(attendeeIds, viewerId)) {
      throw new AppError(
        403,
        ErrorCodes.MEDIA_ACCESS_FORBIDDEN,
        'Anda tidak diundang ke acara ini.',
      );
    }
  }

  async upload(params: {
    familyId: number;
    uploaderPersonId: number;
    file: Express.Multer.File | undefined;
    purposeRaw: unknown;
    contextIdRaw: unknown;
  }): Promise<MediaItem> {
    const purpose = parsePurpose(params.purposeRaw);
    const contextId = parseContextId(params.contextIdRaw);
    const file = params.file;

    if (!file) {
      throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'File gambar wajib diunggah.');
    }

    const mimeType = file.mimetype;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new AppError(
        400,
        ErrorCodes.MEDIA_VALIDATION_FAILED,
        'Format harus image/jpeg, image/png, image/webp, atau image/gif.',
      );
    }

    if (file.size <= 0 || file.size > env.media.maxFileBytes) {
      throw new AppError(
        400,
        ErrorCodes.MEDIA_VALIDATION_FAILED,
        `Ukuran file maksimal ${Math.floor(env.media.maxFileBytes / (1024 * 1024))} MB.`,
      );
    }

    await this.assertUploadAccess(params.familyId, params.uploaderPersonId, purpose, contextId);

    const id = createMediaId();
    const ext = MIME_TO_EXT[mimeType] ?? 'bin';
    const storageKey = buildStorageKey(purpose, id, ext);
    const url = buildPublicUrl(storageKey);

    await mediaStorage.save(storageKey, file.buffer);

    try {
      const row = await mediaRepository.insert({
        id,
        uploaderPersonId: params.uploaderPersonId,
        familyId: params.familyId,
        purpose,
        url,
        storageKey,
        mimeType,
        sizeBytes: file.size,
        contextId,
      });
      return mapMediaRow(row);
    } catch (error) {
      await mediaStorage.remove(storageKey);
      throw error;
    }
  }

  async deleteOne(uploaderPersonId: number, mediaId: string): Promise<void> {
    const row = await mediaRepository.findById(mediaId);
    if (!row || row.status === 'deleted') {
      throw new AppError(404, ErrorCodes.MEDIA_NOT_FOUND, 'Media tidak ditemukan.');
    }
    if (row.uploader_person_id !== uploaderPersonId) {
      throw new AppError(403, ErrorCodes.MEDIA_DELETE_FORBIDDEN, 'Bukan pemilik media.');
    }
    if (row.status !== 'pending') {
      throw new AppError(
        403,
        ErrorCodes.MEDIA_DELETE_FORBIDDEN,
        'Hanya media pending yang boleh dihapus lewat endpoint ini.',
      );
    }

    await mediaRepository.softDelete(row.id);
    await mediaStorage.remove(row.storage_key);
  }

  async cleanup(uploaderPersonId: number, body: unknown): Promise<MediaCleanupResult> {
    const mediaIds = parseMediaIds(body);
    const rows = await mediaRepository.findByIds(mediaIds);
    const byId = new Map(rows.map((row) => [row.id, row]));

    const deletedIds: string[] = [];
    const skippedIds: string[] = [];

    for (const id of mediaIds) {
      const row = byId.get(id);
      if (
        !row ||
        row.status !== 'pending' ||
        row.uploader_person_id !== uploaderPersonId ||
        row.deleted_at
      ) {
        skippedIds.push(id);
        continue;
      }
      deletedIds.push(id);
    }

    if (deletedIds.length > 0) {
      await mediaRepository.softDeleteMany(deletedIds);
      await Promise.all(
        deletedIds.map(async (id) => {
          const row = byId.get(id);
          if (row) {
            await mediaStorage.remove(row.storage_key);
          }
        }),
      );
    }

    return { deletedIds, skippedIds };
  }

  async purgeExpiredPending(): Promise<number> {
    const cutoff = new Date(Date.now() - env.media.pendingTtlMs);
    const expired = await mediaRepository.findExpiredPending(cutoff);
    if (expired.length === 0) {
      return 0;
    }

    const ids = expired.map((row) => row.id);
    await mediaRepository.softDeleteMany(ids);
    await Promise.all(expired.map((row) => mediaStorage.remove(row.storage_key)));
    return ids.length;
  }
}

export const mediaService = new MediaService();
