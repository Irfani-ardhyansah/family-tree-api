import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asBool,
  parseBool,
  parseEnum,
  parseNonEmptyString,
  parseOptionalBool,
  parsePositiveInt,
  resolveFcContext,
  slugifyLabel,
} from '../fc.access';
import { CALENDAR_EVENT_ICON_KEYS, CALENDAR_EVENT_TONE_KEYS } from '../fc.constants';
import type { FcCalendarEventTypeDto, FcCalendarEventTypeRow } from '../fc.types';
import { calendarEventTypesRepository } from './calendar-event-types.repository';

async function toDto(row: FcCalendarEventTypeRow): Promise<FcCalendarEventTypeDto> {
  const isSystem = asBool(row.is_system);
  if (isSystem) {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      iconKey: row.icon_key,
      toneKey: row.tone_key,
      linksToHealth: asBool(row.links_to_health),
      isSystem: true,
      sortOrder: row.sort_order,
      canDelete: false,
      deleteBlockedReason: 'Tipe event sistem tidak boleh dihapus.',
    };
  }

  const used = await calendarEventTypesRepository.countEventsBySlug(row.family_id, row.slug);
  if (used > 0) {
    return {
      id: row.id,
      slug: row.slug,
      label: row.label,
      iconKey: row.icon_key,
      toneKey: row.tone_key,
      linksToHealth: asBool(row.links_to_health),
      isSystem: false,
      sortOrder: row.sort_order,
      canDelete: false,
      deleteBlockedReason: 'Tipe masih dipakai event kalender.',
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    iconKey: row.icon_key,
    toneKey: row.tone_key,
    linksToHealth: asBool(row.links_to_health),
    isSystem: false,
    sortOrder: row.sort_order,
    canDelete: true,
    deleteBlockedReason: null,
  };
}

async function uniqueSlug(familyId: number, base: string): Promise<string> {
  let slug = base;
  let n = 2;
  while (await calendarEventTypesRepository.slugExists(familyId, slug)) {
    slug = `${base}_${n}`.slice(0, 80);
    n += 1;
  }
  return slug;
}

export class CalendarEventTypesService {
  async list(authPersonId: number, familyId: number): Promise<FcCalendarEventTypeDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await calendarEventTypesRepository.ensureSystemTypes(ctx.familyId);
    const rows = await calendarEventTypesRepository.list(ctx.familyId);
    return Promise.all(rows.map(toDto));
  }

  async create(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<FcCalendarEventTypeDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    await calendarEventTypesRepository.ensureSystemTypes(ctx.familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const label = parseNonEmptyString(raw.label, 'label', 120);
    const iconKey = parseEnum(raw.iconKey ?? raw.icon_key, 'iconKey', CALENDAR_EVENT_ICON_KEYS);
    const toneKey = parseEnum(raw.toneKey ?? raw.tone_key, 'toneKey', CALENDAR_EVENT_TONE_KEYS);
    const linksToHealth =
      parseOptionalBool(raw.linksToHealth ?? raw.links_to_health, 'linksToHealth') ?? false;
    const sortOrder =
      raw.sortOrder === undefined && raw.sort_order === undefined
        ? (await calendarEventTypesRepository.maxSortOrder(ctx.familyId)) + 10
        : parsePositiveInt(raw.sortOrder ?? raw.sort_order, 'sortOrder');

    const slug = await uniqueSlug(ctx.familyId, slugifyLabel(label));
    const row = await calendarEventTypesRepository.create({
      familyId: ctx.familyId,
      slug,
      label,
      iconKey,
      toneKey,
      linksToHealth,
      sortOrder,
    });
    return toDto(row);
  }

  async update(
    authPersonId: number,
    familyId: number,
    idRaw: string,
    body: unknown,
  ): Promise<FcCalendarEventTypeDto> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await calendarEventTypesRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.FC_CALENDAR_EVENT_TYPE_NOT_FOUND,
        'Tipe event kalender tidak ditemukan.',
      );
    }
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    if (raw.slug !== undefined && asBool(existing.is_system)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'slug tipe sistem tidak dapat diubah.');
    }

    const patch: Partial<{
      label: string;
      icon_key: string;
      tone_key: string;
      links_to_health: boolean;
      sort_order: number;
      slug: string;
    }> = {};

    if (raw.label !== undefined) {
      patch.label = parseNonEmptyString(raw.label, 'label', 120);
    }
    if (raw.iconKey !== undefined || raw.icon_key !== undefined) {
      patch.icon_key = parseEnum(
        raw.iconKey ?? raw.icon_key,
        'iconKey',
        CALENDAR_EVENT_ICON_KEYS,
      );
    }
    if (raw.toneKey !== undefined || raw.tone_key !== undefined) {
      patch.tone_key = parseEnum(
        raw.toneKey ?? raw.tone_key,
        'toneKey',
        CALENDAR_EVENT_TONE_KEYS,
      );
    }
    if (raw.linksToHealth !== undefined || raw.links_to_health !== undefined) {
      patch.links_to_health = parseBool(
        raw.linksToHealth ?? raw.links_to_health,
        'linksToHealth',
      );
    }
    if (raw.sortOrder !== undefined || raw.sort_order !== undefined) {
      patch.sort_order = parsePositiveInt(raw.sortOrder ?? raw.sort_order, 'sortOrder');
    }
    if (raw.slug !== undefined && !asBool(existing.is_system)) {
      const slug = slugifyLabel(parseNonEmptyString(raw.slug, 'slug', 80));
      if (await calendarEventTypesRepository.slugExists(ctx.familyId, slug, id)) {
        throw new AppError(409, ErrorCodes.CONFLICT, 'slug sudah dipakai.');
      }
      patch.slug = slug;
    }

    if (Object.keys(patch).length > 0) {
      await calendarEventTypesRepository.update(ctx.familyId, id, patch);
    }
    const updated = await calendarEventTypesRepository.findById(ctx.familyId, id);
    return toDto(updated!);
  }

  async remove(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<{ deleted: true }> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const existing = await calendarEventTypesRepository.findById(ctx.familyId, id);
    if (!existing) {
      throw new AppError(
        404,
        ErrorCodes.FC_CALENDAR_EVENT_TYPE_NOT_FOUND,
        'Tipe event kalender tidak ditemukan.',
      );
    }
    const dto = await toDto(existing);
    if (!dto.canDelete) {
      const status = asBool(existing.is_system) ? 403 : 409;
      const code = asBool(existing.is_system) ? ErrorCodes.FORBIDDEN : ErrorCodes.CONFLICT;
      throw new AppError(status, code, dto.deleteBlockedReason ?? 'Tidak dapat dihapus.');
    }
    await calendarEventTypesRepository.remove(ctx.familyId, id);
    return { deleted: true };
  }
}

export const calendarEventTypesService = new CalendarEventTypesService();
