import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  attachResolvedMedia,
  resolvePendingPhotos,
} from '../../core/media/media.attach.service';
import {
  asBool,
  parseBool,
  parseEnum,
  parseJsonObject,
  parseNonEmptyString,
  parseOptionalBool,
  parseOptionalDateOnly,
  parseOptionalString,
  parsePositiveInt,
  resolveFcContext,
  toDateOnly,
  toIso,
} from '../fc.access';
import { MAX_PHOTOS_BY_PURPOSE } from '../../core/media/media.constants';
import {
  DEFAULT_REMINDER_DAYS,
  EXPIRING_SOON_DAYS,
  REMINDER_DAYS_OPTIONS,
  type ReminderDays,
} from '../fc.constants';
import {
  decryptDocumentNumber,
  encryptDocumentNumber,
  maskDocumentNumber,
} from '../fc.crypto';
import { mediaRepository } from '../../core/media/media.repository';
import { mediaStorage } from '../../core/media/media.storage';
import { documentTypesRepository } from '../document-types/document-types.repository';
import { isNuclearMember } from '../members/nuclear-members';
import type {
  FcDocumentDetailDto,
  FcDocumentListItemDto,
  FcDocumentReminderDto,
  FcDocumentRow,
  FcDocumentStatus,
} from '../fc.types';
import { documentsRepository } from './documents.repository';

async function purgeDocumentMedia(mediaIds: string[]): Promise<void> {
  if (mediaIds.length === 0) return;
  const rows = await mediaRepository.findByIds(mediaIds);
  await mediaRepository.softDeleteMany(mediaIds);
  await Promise.all(rows.map((row) => mediaStorage.remove(row.storage_key)));
}

function todayDateOnly(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysUntil(expiry: string, today: string): number {
  const dueTime = new Date(`${expiry}T00:00:00.000Z`).getTime();
  const todayTime = new Date(`${today}T00:00:00.000Z`).getTime();
  return Math.ceil((dueTime - todayTime) / 86_400_000);
}

export function computeDocumentStatus(
  isLifetime: boolean,
  expiresAt: string | null,
  today = todayDateOnly(),
): { status: FcDocumentStatus; daysUntilExpiry: number | null } {
  if (isLifetime || !expiresAt) {
    return { status: 'active', daysUntilExpiry: null };
  }
  const days = daysUntil(expiresAt, today);
  if (days < 0) return { status: 'expired', daysUntilExpiry: days };
  if (days <= EXPIRING_SOON_DAYS) {
    return { status: 'expiring_soon', daysUntilExpiry: days };
  }
  return { status: 'active', daysUntilExpiry: days };
}

function statusSortRank(status: FcDocumentStatus): number {
  if (status === 'expired') return 0;
  if (status === 'expiring_soon') return 1;
  return 2;
}

function documentTitle(row: FcDocumentRow, typeLabel?: string): string {
  if (row.custom_title?.trim()) return row.custom_title.trim();
  return typeLabel ?? row.document_type_slug;
}

function parseExtrasBody(raw: unknown): Record<string, string> {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'extras harus object.');
  }
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === null || v === undefined || v === '') continue;
    if (typeof v !== 'string') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `extras.${k} harus string.`);
    }
    out[k] = v.trim();
  }
  return out;
}

async function assertSelectablePerson(
  familyId: number,
  actorPersonId: number,
  personId: number,
): Promise<void> {
  const ok = await isNuclearMember(familyId, actorPersonId, personId);
  if (!ok) {
    throw new AppError(
      404,
      ErrorCodes.FC_MEMBER_NOT_FOUND,
      'Anggota tidak valid untuk dokumen Family Core.',
    );
  }
}

async function toListItem(
  row: FcDocumentRow,
  fileCount: number,
  typeLabel?: string,
  revealNumber = false,
): Promise<FcDocumentListItemDto | FcDocumentDetailDto> {
  const plaintext = decryptDocumentNumber(row.document_number_cipher, row.document_number_iv);
  const isLifetime = asBool(row.is_lifetime);
  const expiresAt = row.expires_at ? toDateOnly(row.expires_at) : null;
  const { status, daysUntilExpiry } = computeDocumentStatus(isLifetime, expiresAt);
  const reminderDays =
    row.reminder_days != null &&
    (REMINDER_DAYS_OPTIONS as readonly number[]).includes(row.reminder_days)
      ? (row.reminder_days as ReminderDays)
      : null;

  const base: FcDocumentListItemDto = {
    id: row.id,
    personId: row.person_id,
    documentTypeSlug: row.document_type_slug,
    title: documentTitle(row, typeLabel),
    numberMasked: maskDocumentNumber(plaintext),
    issuedAt: row.issued_at ? toDateOnly(row.issued_at) : null,
    expiresAt,
    isLifetime,
    status,
    daysUntilExpiry,
    reminderEnabled: asBool(row.reminder_enabled),
    reminderDays,
    extras: parseJsonObject(row.extras),
    fileCount,
    createdAt: toIso(row.created_at)!,
    updatedAt: toIso(row.updated_at)!,
  };

  if (!revealNumber) return base;

  const files = await documentsRepository.listFiles(row.id);
  return {
    ...base,
    number: plaintext,
    notes: row.notes,
    customTitle: row.custom_title,
    createdByPersonId: row.created_by_person_id,
    files: files.map((f) => ({
      id: f.id,
      mediaId: f.media_id,
      url: f.url ?? '',
      sortOrder: f.sort_order,
    })),
  };
}

export class DocumentsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<FcDocumentListItemDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await documentTypesRepository.ensureSystemTypes(ctx.familyId);
    const personId =
      query.personId === undefined
        ? undefined
        : parsePositiveInt(query.personId, 'personId');
    if (personId != null) {
      await assertSelectablePerson(ctx.familyId, ctx.actorPersonId, personId);
    }

    const rows = await documentsRepository.list(ctx.familyId, personId);
    const types = await documentTypesRepository.list(ctx.familyId);
    const typeMap = new Map(types.map((t) => [t.slug, t.label]));
    const counts = await documentsRepository.countFilesByDocumentIds(rows.map((r) => r.id));

    const items = await Promise.all(
      rows.map((row) =>
        toListItem(row, counts.get(row.id) ?? 0, typeMap.get(row.document_type_slug)),
      ),
    );

    return (items as FcDocumentListItemDto[]).sort((a, b) => {
      const rank = statusSortRank(a.status) - statusSortRank(b.status);
      if (rank !== 0) return rank;
      const da = a.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
      const db = b.daysUntilExpiry ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<FcDocumentDetailDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await documentsRepository.findById(ctx.familyId, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.FC_DOCUMENT_NOT_FOUND, 'Dokumen tidak ditemukan.');
    }
    const type = await documentTypesRepository.findBySlug(
      ctx.familyId,
      row.document_type_slug,
    );
    return (await toListItem(
      row,
      0,
      type?.label,
      true,
    )) as FcDocumentDetailDto;
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<FcDocumentDetailDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await documentTypesRepository.ensureSystemTypes(ctx.familyId);
    const parsed = await this.parseBody(ctx.familyId, ctx.actorPersonId, body, null);

    const { cipher, iv } = encryptDocumentNumber(parsed.documentNumber);
    const row = await documentsRepository.create({
      familyId: ctx.familyId,
      personId: parsed.personId,
      documentTypeSlug: parsed.documentTypeSlug,
      customTitle: parsed.customTitle,
      cipher,
      iv,
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      isLifetime: parsed.isLifetime,
      notes: parsed.notes,
      extras: parsed.extras,
      reminderEnabled: parsed.reminderEnabled,
      reminderDays: parsed.reminderDays,
      createdByPersonId: ctx.actorPersonId,
    });

    if (parsed.mediaIds.length > 0) {
      await documentsRepository.replaceFiles(row.id, parsed.mediaIds);
      await attachResolvedMedia({
        mediaIds: parsed.mediaIds,
        purpose: 'fc_document',
        attachedToId: String(row.id),
      });
    }

    return this.getById(authPersonId, familyId, String(row.id));
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<FcDocumentDetailDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await documentsRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.FC_DOCUMENT_NOT_FOUND, 'Dokumen tidak ditemukan.');
    }
    const parsed = await this.parseBody(ctx.familyId, ctx.actorPersonId, body, existing);

    const patch: Record<string, unknown> = {
      person_id: parsed.personId,
      document_type_slug: parsed.documentTypeSlug,
      custom_title: parsed.customTitle,
      issued_at: parsed.issuedAt,
      expires_at: parsed.expiresAt,
      is_lifetime: parsed.isLifetime,
      notes: parsed.notes,
      extras: JSON.stringify(parsed.extras),
      reminder_enabled: parsed.reminderEnabled,
      reminder_days: parsed.reminderDays,
    };

    if (parsed.documentNumberChanged && parsed.documentNumber) {
      const enc = encryptDocumentNumber(parsed.documentNumber);
      patch.document_number_cipher = enc.cipher;
      patch.document_number_iv = enc.iv;
    }

    await documentsRepository.update(ctx.familyId, id, patch);

    if (parsed.mediaIdsProvided) {
      const previous = await documentsRepository.listFiles(id);
      const keep = new Set(parsed.mediaIds);
      const removed = previous.filter((f) => !keep.has(f.media_id)).map((f) => f.media_id);
      await documentsRepository.replaceFiles(id, parsed.mediaIds);
      await attachResolvedMedia({
        mediaIds: parsed.mediaIds,
        purpose: 'fc_document',
        attachedToId: String(id),
      });
      await purgeDocumentMedia(removed);
    }

    return this.getById(authPersonId, familyId, String(id));
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await documentsRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.FC_DOCUMENT_NOT_FOUND, 'Dokumen tidak ditemukan.');
    }
    const files = await documentsRepository.listFiles(id);
    await documentsRepository.replaceFiles(id, []);
    await documentsRepository.softDelete(ctx.familyId, id);
    await purgeDocumentMedia(files.map((f) => f.media_id));
    return { deleted: true };
  }

  async removeFile(
    authPersonId: number,
    familyId: number,
    documentIdRaw: string,
    fileIdRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const documentId = parsePositiveInt(documentIdRaw, 'id');
    const document = await documentsRepository.findById(ctx.familyId, documentId);
    if (!document) {
      throw new AppError(404, ErrorCodes.FC_DOCUMENT_NOT_FOUND, 'Dokumen tidak ditemukan.');
    }

    const file = fileIdRaw.startsWith('med_')
      ? await documentsRepository.findFileByMediaId(documentId, fileIdRaw)
      : await documentsRepository.findFile(documentId, parsePositiveInt(fileIdRaw, 'fileId'));
    if (!file) {
      throw new AppError(404, ErrorCodes.MEDIA_NOT_FOUND, 'File dokumen tidak ditemukan.');
    }

    await documentsRepository.deleteFile(documentId, file.id);
    await purgeDocumentMedia([file.media_id]);
    return { deleted: true };
  }

  async reminders(
    authPersonId: number,
    familyId: number,
  ): Promise<FcDocumentReminderDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const rows = await documentsRepository.listForReminders(ctx.familyId);
    const types = await documentTypesRepository.list(ctx.familyId);
    const typeMap = new Map(types.map((t) => [t.slug, t.label]));
    const today = todayDateOnly();
    const out: FcDocumentReminderDto[] = [];

    for (const row of rows) {
      if (!row.expires_at) continue;
      const expiresAt = toDateOnly(row.expires_at);
      const days = daysUntil(expiresAt, today);
      const window = row.reminder_days ?? DEFAULT_REMINDER_DAYS;
      if (days > window) continue;

      const { status } = computeDocumentStatus(false, expiresAt, today);
      const title = documentTitle(row, typeMap.get(row.document_type_slug));
      out.push({
        id: `document_expiry:${row.id}`,
        type: 'document_expiry',
        title:
          status === 'expired'
            ? `${title} sudah kadaluarsa`
            : `${title} segera kadaluarsa`,
        body:
          status === 'expired'
            ? `Kadaluarsa sejak ${Math.abs(days)} hari yang lalu`
            : `Kadaluarsa dalam ${days} hari`,
        dueAt: `${expiresAt}T00:00:00.000Z`,
        relatedType: 'document',
        relatedId: row.id,
        link: `/core/documents/${row.id}`,
        status,
      });
    }

    return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }

  private async parseBody(
    familyId: number,
    actorPersonId: number,
    body: unknown,
    existing: FcDocumentRow | null,
  ): Promise<{
    personId: number;
    documentTypeSlug: string;
    customTitle: string | null;
    documentNumber: string;
    documentNumberChanged: boolean;
    issuedAt: string | null;
    expiresAt: string | null;
    isLifetime: boolean;
    notes: string | null;
    extras: Record<string, string>;
    reminderEnabled: boolean;
    reminderDays: number | null;
    mediaIds: string[];
    mediaIdsProvided: boolean;
  }> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;

    const personId =
      raw.personId !== undefined
        ? parsePositiveInt(raw.personId, 'personId')
        : existing?.person_id;
    if (personId == null) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'personId wajib diisi.');
    }
    await assertSelectablePerson(familyId, actorPersonId, personId);

    const documentTypeSlug =
      raw.documentTypeSlug !== undefined || raw.type !== undefined
        ? parseNonEmptyString(raw.documentTypeSlug ?? raw.type, 'documentTypeSlug', 80)
        : existing?.document_type_slug;
    if (!documentTypeSlug) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'documentTypeSlug wajib diisi.');
    }

    const type = await documentTypesRepository.findBySlug(familyId, documentTypeSlug);
    if (!type) {
      throw new AppError(
        404,
        ErrorCodes.FC_DOCUMENT_TYPE_NOT_FOUND,
        'Jenis dokumen tidak ditemukan.',
      );
    }

    let customTitle: string | null;
    if (raw.customTitle !== undefined || raw.custom_title !== undefined) {
      customTitle =
        parseOptionalString(raw.customTitle ?? raw.custom_title, 'customTitle', 160) ?? null;
    } else {
      customTitle = existing?.custom_title ?? null;
    }
    if (asBool(type.allow_custom_title) && !customTitle) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'customTitle wajib untuk jenis dokumen ini.',
      );
    }
    if (!asBool(type.allow_custom_title)) {
      customTitle = null;
    }

    let documentNumber: string;
    let documentNumberChanged = false;
    if (raw.documentNumber !== undefined || raw.number !== undefined) {
      documentNumber = parseNonEmptyString(
        raw.documentNumber ?? raw.number,
        'documentNumber',
        120,
      );
      documentNumberChanged = true;
    } else if (existing) {
      documentNumber = decryptDocumentNumber(
        existing.document_number_cipher,
        existing.document_number_iv,
      );
    } else {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'documentNumber wajib diisi.');
    }

    const issuedAt =
      raw.issuedAt !== undefined || raw.issued_at !== undefined
        ? (parseOptionalDateOnly(raw.issuedAt ?? raw.issued_at, 'issuedAt') ?? null)
        : existing?.issued_at
          ? toDateOnly(existing.issued_at)
          : null;

    let isLifetime: boolean;
    if (raw.isLifetime !== undefined || raw.is_lifetime !== undefined) {
      isLifetime = parseBool(raw.isLifetime ?? raw.is_lifetime, 'isLifetime');
    } else if (existing) {
      isLifetime = asBool(existing.is_lifetime);
    } else {
      isLifetime = asBool(type.default_lifetime);
    }

    let expiresAt: string | null;
    if (raw.expiresAt !== undefined || raw.expires_at !== undefined) {
      expiresAt =
        parseOptionalDateOnly(raw.expiresAt ?? raw.expires_at, 'expiresAt') ?? null;
    } else if (existing?.expires_at) {
      expiresAt = toDateOnly(existing.expires_at);
    } else {
      expiresAt = null;
    }

    if (isLifetime) {
      expiresAt = null;
    } else if (!expiresAt) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'expiresAt wajib jika bukan seumur hidup.',
      );
    }

    const notes =
      raw.notes !== undefined
        ? (parseOptionalString(raw.notes, 'notes', 2000) ?? null)
        : (existing?.notes ?? null);

    const extras =
      raw.extras !== undefined
        ? parseExtrasBody(raw.extras)
        : existing
          ? parseJsonObject(existing.extras)
          : {};

    let reminderEnabled: boolean;
    if (raw.reminderEnabled !== undefined || raw.reminder_enabled !== undefined) {
      reminderEnabled = parseBool(
        raw.reminderEnabled ?? raw.reminder_enabled,
        'reminderEnabled',
      );
    } else if (existing) {
      reminderEnabled = asBool(existing.reminder_enabled);
    } else {
      reminderEnabled = !isLifetime;
    }

    let reminderDays: number | null;
    if (raw.reminderDays !== undefined || raw.reminder_days !== undefined) {
      if (raw.reminderDays === null || raw.reminder_days === null) {
        reminderDays = null;
      } else {
        reminderDays = parseEnum(
          Number(raw.reminderDays ?? raw.reminder_days),
          'reminderDays',
          REMINDER_DAYS_OPTIONS,
        );
      }
    } else if (existing) {
      reminderDays = existing.reminder_days;
    } else {
      reminderDays = DEFAULT_REMINDER_DAYS;
    }

    if (isLifetime) {
      reminderEnabled = false;
      reminderDays = null;
    } else if (reminderEnabled && reminderDays == null) {
      reminderDays = DEFAULT_REMINDER_DAYS;
    }

    let mediaIds: string[] = [];
    let mediaIdsProvided = false;
    if (raw.mediaIds !== undefined) {
      mediaIdsProvided = true;
      if (!Array.isArray(raw.mediaIds)) {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'mediaIds harus array.');
      }
      const resolved = await resolvePendingPhotos({
        uploaderPersonId: actorPersonId,
        purpose: 'fc_document',
        mediaIds: raw.mediaIds.filter((id): id is string => typeof id === 'string'),
        maxCount: MAX_PHOTOS_BY_PURPOSE.fc_document,
        requireManaged: true,
      });
      mediaIds = resolved.mediaIds;
    }

    return {
      personId,
      documentTypeSlug,
      customTitle,
      documentNumber,
      documentNumberChanged,
      issuedAt,
      expiresAt,
      isLifetime,
      notes,
      extras,
      reminderEnabled,
      reminderDays,
      mediaIds,
      mediaIdsProvided,
    };
  }
}

export const documentsService = new DocumentsService();
