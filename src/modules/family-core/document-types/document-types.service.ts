import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asBool,
  parseBool,
  parseEnum,
  parseNonEmptyString,
  parseOptionalBool,
  parsePositiveInt,
  parseJsonArray,
  resolveFcContext,
  slugifyLabel,
} from '../fc.access';
import {
  DOCUMENT_ICON_KEYS,
  DOCUMENT_TONE_KEYS,
  type DocumentExtraFieldDef,
} from '../fc.constants';
import type { FcDocumentTypeDto, FcDocumentTypeRow } from '../fc.types';
import { documentTypesRepository } from './document-types.repository';

function parseExtras(raw: unknown): DocumentExtraFieldDef[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'extras harus array.');
  }
  const out: DocumentExtraFieldDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'extras item tidak valid.');
    }
    const row = item as Record<string, unknown>;
    const key = parseNonEmptyString(row.key, 'extras.key', 40);
    const label = parseNonEmptyString(row.label, 'extras.label', 80);
    const placeholder =
      row.placeholder === undefined || row.placeholder === null || row.placeholder === ''
        ? undefined
        : parseNonEmptyString(row.placeholder, 'extras.placeholder', 120);
    out.push(placeholder ? { key, label, placeholder } : { key, label });
  }
  return out;
}

async function toDto(row: FcDocumentTypeRow): Promise<FcDocumentTypeDto> {
  const isSystem = asBool(row.is_system);
  const extras = parseJsonArray<DocumentExtraFieldDef>(row.extras);
  if (isSystem) {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      iconKey: row.icon_key,
      toneKey: row.tone_key,
      extras,
      defaultLifetime: asBool(row.default_lifetime),
      allowCustomTitle: asBool(row.allow_custom_title),
      isSystem: true,
      sortOrder: row.sort_order,
      canDelete: false,
      deleteBlockedReason: 'Jenis dokumen sistem tidak boleh dihapus.',
    };
  }

  const used = await documentTypesRepository.countDocumentsBySlug(row.family_id, row.slug);
  if (used > 0) {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      iconKey: row.icon_key,
      toneKey: row.tone_key,
      extras,
      defaultLifetime: asBool(row.default_lifetime),
      allowCustomTitle: asBool(row.allow_custom_title),
      isSystem: false,
      sortOrder: row.sort_order,
      canDelete: false,
      deleteBlockedReason: 'Jenis masih dipakai dokumen.',
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    iconKey: row.icon_key,
    toneKey: row.tone_key,
    extras,
    defaultLifetime: asBool(row.default_lifetime),
    allowCustomTitle: asBool(row.allow_custom_title),
    isSystem: false,
    sortOrder: row.sort_order,
    canDelete: true,
    deleteBlockedReason: null,
  };
}

async function uniqueSlug(familyId: number, base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await documentTypesRepository.slugExists(familyId, slug)) {
    slug = `${base}_${n}`.slice(0, 80);
    n += 1;
  }
  return slug;
}

export class DocumentTypesService {
  async list(authPersonId: number, familyId: number): Promise<FcDocumentTypeDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await documentTypesRepository.ensureSystemTypes(ctx.familyId);
    const rows = await documentTypesRepository.list(ctx.familyId);
    return Promise.all(rows.map(toDto));
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<FcDocumentTypeDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await documentTypesRepository.ensureSystemTypes(ctx.familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const label = parseNonEmptyString(raw.label, 'label', 120);
    const iconKey = parseEnum(raw.iconKey ?? raw.icon_key, 'iconKey', DOCUMENT_ICON_KEYS);
    const toneKey = parseEnum(raw.toneKey ?? raw.tone_key, 'toneKey', DOCUMENT_TONE_KEYS);
    const extras = parseExtras(raw.extras);
    const defaultLifetime = parseOptionalBool(raw.defaultLifetime ?? raw.default_lifetime, 'defaultLifetime') ?? false;
    const allowCustomTitle =
      parseOptionalBool(raw.allowCustomTitle ?? raw.allow_custom_title, 'allowCustomTitle') ?? false;
    const sortOrder =
      raw.sortOrder === undefined && raw.sort_order === undefined
        ? (await documentTypesRepository.maxSortOrder(ctx.familyId)) + 10
        : parsePositiveInt(raw.sortOrder ?? raw.sort_order, 'sortOrder');

    const slug = await uniqueSlug(ctx.familyId, slugifyLabel(label));
    const row = await documentTypesRepository.create({
      familyId: ctx.familyId,
      slug,
      label,
      iconKey,
      toneKey,
      extras,
      defaultLifetime,
      allowCustomTitle,
      sortOrder,
    });
    return toDto(row);
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<FcDocumentTypeDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await documentTypesRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.FC_DOCUMENT_TYPE_NOT_FOUND,
        'Jenis dokumen tidak ditemukan.',
      );
    }
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    if (raw.slug !== undefined && asBool(existing.is_system)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'slug jenis sistem tidak dapat diubah.');
    }

    const patch: Partial<{
      label: string;
      icon_key: string;
      tone_key: string;
      extras: string;
      default_lifetime: boolean;
      allow_custom_title: boolean;
      sort_order: number;
      slug: string;
    }> = {};

    if (raw.label !== undefined) {
      patch.label = parseNonEmptyString(raw.label, 'label', 120);
    }
    if (raw.iconKey !== undefined || raw.icon_key !== undefined) {
      patch.icon_key = parseEnum(raw.iconKey ?? raw.icon_key, 'iconKey', DOCUMENT_ICON_KEYS);
    }
    if (raw.toneKey !== undefined || raw.tone_key !== undefined) {
      patch.tone_key = parseEnum(raw.toneKey ?? raw.tone_key, 'toneKey', DOCUMENT_TONE_KEYS);
    }
    if (raw.extras !== undefined) {
      patch.extras = JSON.stringify(parseExtras(raw.extras));
    }
    if (raw.defaultLifetime !== undefined || raw.default_lifetime !== undefined) {
      patch.default_lifetime = parseBool(
        raw.defaultLifetime ?? raw.default_lifetime,
        'defaultLifetime',
      );
    }
    if (raw.allowCustomTitle !== undefined || raw.allow_custom_title !== undefined) {
      patch.allow_custom_title = parseBool(
        raw.allowCustomTitle ?? raw.allow_custom_title,
        'allowCustomTitle',
      );
    }
    if (raw.sortOrder !== undefined || raw.sort_order !== undefined) {
      patch.sort_order = parsePositiveInt(raw.sortOrder ?? raw.sort_order, 'sortOrder');
    }
    if (raw.slug !== undefined && !asBool(existing.is_system)) {
      const slug = slugifyLabel(parseNonEmptyString(raw.slug, 'slug', 80));
      if (await documentTypesRepository.slugExists(ctx.familyId, slug, id)) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'slug sudah dipakai.');
      }
      patch.slug = slug;
    }

    if (Object.keys(patch).length > 0) {
      await documentTypesRepository.update(ctx.familyId, id, patch);
    }
    const updated = await documentTypesRepository.findById(ctx.familyId, id);
    return toDto(updated!);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await documentTypesRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.FC_DOCUMENT_TYPE_NOT_FOUND,
        'Jenis dokumen tidak ditemukan.',
      );
    }
    const dto = await toDto(existing);
    if (!dto.canDelete) {
      const status = asBool(existing.is_system) ? 403 : 409;
      const code = asBool(existing.is_system) ? ErrorCodes.FORBIDDEN : ErrorCodes.CONFLICT;
      throw new AppError(status, code, dto.deleteBlockedReason ?? 'Tidak dapat dihapus.');
    }
    await documentTypesRepository.remove(ctx.familyId, id);
    return { deleted: true };
  }
}

export const documentTypesService = new DocumentTypesService();
