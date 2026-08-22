import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { FcDocumentFileRow, FcDocumentRow } from '../fc.types';

export class DocumentsRepository {
  async list(familyId: number, personId?: number): Promise<FcDocumentRow[]> {
    let q = db(Tables.FC_DOCUMENTS)
      .where({ family_id: familyId })
      .whereNull('deleted_at');
    if (personId != null) {
      q = q.where({ person_id: personId });
    }
    return q.select<FcDocumentRow[]>('*');
  }

  async findById(familyId: number, id: number): Promise<FcDocumentRow | undefined> {
    return db(Tables.FC_DOCUMENTS)
      .where({ id, family_id: familyId })
      .whereNull('deleted_at')
      .first<FcDocumentRow>('*');
  }

  async create(input: {
    familyId: number;
    personId: number;
    documentTypeSlug: string;
    customTitle: string | null;
    cipher: string;
    iv: string;
    issuedAt: string | null;
    expiresAt: string | null;
    isLifetime: boolean;
    notes: string | null;
    extras: Record<string, string>;
    reminderEnabled: boolean;
    reminderDays: number | null;
    createdByPersonId: number;
  }): Promise<FcDocumentRow> {
    const [id] = await db(Tables.FC_DOCUMENTS).insert({
      family_id: input.familyId,
      person_id: input.personId,
      document_type_slug: input.documentTypeSlug,
      custom_title: input.customTitle,
      document_number_cipher: input.cipher,
      document_number_iv: input.iv,
      issued_at: input.issuedAt,
      expires_at: input.expiresAt,
      is_lifetime: input.isLifetime,
      notes: input.notes,
      extras: JSON.stringify(input.extras),
      reminder_enabled: input.reminderEnabled,
      reminder_days: input.reminderDays,
      created_by_person_id: input.createdByPersonId,
    });
    return (await this.findById(input.familyId, id))!;
  }

  async update(
    familyId: number,
    id: number,
    patch: Record<string, unknown>,
  ): Promise<void> {
    await db(Tables.FC_DOCUMENTS)
      .where({ id, family_id: familyId })
      .whereNull('deleted_at')
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async softDelete(familyId: number, id: number): Promise<void> {
    await db(Tables.FC_DOCUMENTS)
      .where({ id, family_id: familyId })
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
  }

  async listFiles(documentId: number): Promise<FcDocumentFileRow[]> {
    return db(`${Tables.FC_DOCUMENT_FILES} as f`)
      .leftJoin(`${Tables.MEDIA} as m`, 'm.id', 'f.media_id')
      .where('f.document_id', documentId)
      .orderBy('f.sort_order', 'asc')
      .orderBy('f.id', 'asc')
      .select<FcDocumentFileRow[]>(
        'f.id',
        'f.document_id',
        'f.media_id',
        'f.sort_order',
        'f.created_at',
        'f.updated_at',
        'm.url',
      );
  }

  async countFilesByDocumentIds(
    documentIds: number[],
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (documentIds.length === 0) return map;
    const rows = await db(Tables.FC_DOCUMENT_FILES)
      .whereIn('document_id', documentIds)
      .groupBy('document_id')
      .select<{ document_id: number; total: number | string }[]>(
        'document_id',
        db.raw('COUNT(*) as total'),
      );
    for (const row of rows) {
      map.set(row.document_id, Number(row.total));
    }
    return map;
  }

  async replaceFiles(documentId: number, mediaIds: string[]): Promise<void> {
    await db.transaction(async (trx) => {
      await trx(Tables.FC_DOCUMENT_FILES).where({ document_id: documentId }).del();
      if (mediaIds.length === 0) return;
      await trx(Tables.FC_DOCUMENT_FILES).insert(
        mediaIds.map((mediaId, index) => ({
          document_id: documentId,
          media_id: mediaId,
          sort_order: index,
        })),
      );
    });
  }

  async listForReminders(familyId: number): Promise<FcDocumentRow[]> {
    return db(Tables.FC_DOCUMENTS)
      .where({ family_id: familyId, reminder_enabled: true })
      .whereNull('deleted_at')
      .whereNotNull('expires_at')
      .where({ is_lifetime: false })
      .select<FcDocumentRow[]>('*');
  }
}

export const documentsRepository = new DocumentsRepository();
