import db from '../../config/database';
import {
  MediaAttachedToType,
  MediaPurpose,
  MediaRow,
  MediaStatus,
} from './media.types';

export type InsertMediaInput = {
  id: string;
  uploaderPersonId: number;
  familyId: number;
  purpose: MediaPurpose;
  url: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  width?: number | null;
  height?: number | null;
  contextId?: string | null;
};

export class MediaRepository {
  async insert(input: InsertMediaInput): Promise<MediaRow> {
    await db('media').insert({
      id: input.id,
      uploader_person_id: input.uploaderPersonId,
      family_id: input.familyId,
      purpose: input.purpose,
      status: 'pending',
      url: input.url,
      storage_key: input.storageKey,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      width: input.width ?? null,
      height: input.height ?? null,
      context_id: input.contextId ?? null,
    });

    const row = await this.findById(input.id);
    if (!row) {
      throw new Error('Failed to load inserted media');
    }
    return row;
  }

  async findById(id: string): Promise<MediaRow | undefined> {
    return db('media').where({ id }).first<MediaRow>();
  }

  async findByIds(ids: string[]): Promise<MediaRow[]> {
    if (ids.length === 0) {
      return [];
    }
    return db('media').whereIn('id', ids).select<MediaRow[]>('*');
  }

  async findByUrls(urls: string[]): Promise<MediaRow[]> {
    if (urls.length === 0) {
      return [];
    }
    return db('media').whereIn('url', urls).select<MediaRow[]>('*');
  }

  async softDelete(id: string): Promise<void> {
    await db('media').where({ id }).update({
      status: 'deleted' satisfies MediaStatus,
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  async softDeleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await db('media').whereIn('id', ids).update({
      status: 'deleted' satisfies MediaStatus,
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  async attachMany(
    ids: string[],
    attachedToType: MediaAttachedToType,
    attachedToId: string,
  ): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await db('media').whereIn('id', ids).update({
      status: 'attached' satisfies MediaStatus,
      attached_to_type: attachedToType,
      attached_to_id: attachedToId,
      updated_at: db.fn.now(),
    });
  }

  async findExpiredPending(before: Date): Promise<MediaRow[]> {
    return db('media')
      .where({ status: 'pending' })
      .andWhere('created_at', '<', before)
      .select<MediaRow[]>('*');
  }
}

export const mediaRepository = new MediaRepository();
