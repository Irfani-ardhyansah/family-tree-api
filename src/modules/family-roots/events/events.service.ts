import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { formatBirthDate } from '../../core/auth/auth.mapper';
import {
  attachResolvedMedia,
  resolvePendingPhotos,
} from '../../core/media/media.attach.service';
import { MAX_PHOTOS_BY_PURPOSE } from '../../core/media/media.constants';
import { getVisiblePersonIds } from '../persons/perspective-subgraph.service';
import { personsRepository } from '../persons/persons.repository';
import { ReadFocusMeta } from '../persons/persons.types';
import {
  canAccessEvent,
  canManageEvent,
  isEventVisibleInPerspective,
  isRestrictedEvent,
} from './event-access.service';
import { eventsRepository } from './events.repository';
import {
  CalendarEventItem,
  CreateContributionInput,
  EventDetailResponse,
  EventItem,
  EventListQuery,
  EventListResponse,
  EventRow,
  EventType,
  UpsertEventInput,
} from './events.types';

const EVENT_TYPES: EventType[] = ['wedding', 'birth', 'death', 'birthday', 'reunion', 'other'];
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
/** Safety cap for calendar view (all overlap events in range). */
const CALENDAR_MAX_EVENTS = 500;
/** Inclusive day span max for `view=calendar` (≈ month grid + padding). */
const CALENDAR_MAX_SPAN_DAYS = 62;

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return formatBirthDate(value);
  }
  return value.slice(0, 10);
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

/** Inclusive day count between YYYY-MM-DD strings (UTC date parts). */
function inclusiveDaySpan(dateFrom: string, dateTo: string): number {
  const fromMs = Date.UTC(
    Number(dateFrom.slice(0, 4)),
    Number(dateFrom.slice(5, 7)) - 1,
    Number(dateFrom.slice(8, 10)),
  );
  const toMs = Date.UTC(
    Number(dateTo.slice(0, 4)),
    Number(dateTo.slice(5, 7)) - 1,
    Number(dateTo.slice(8, 10)),
  );
  return Math.floor((toMs - fromMs) / 86_400_000) + 1;
}

function parseListQuery(raw: Record<string, unknown>): EventListQuery {
  const isCalendar =
    raw.view !== undefined &&
    String(Array.isArray(raw.view) ? raw.view[0] : raw.view).trim() === 'calendar';

  if (raw.view !== undefined && !isCalendar) {
    throw new AppError(
      400,
      ErrorCodes.EVENT_VALIDATION_FAILED,
      'Parameter view tidak valid. Gunakan view=calendar.',
    );
  }

  const pageRaw = raw.page;
  const limitRaw = raw.limit;

  const page =
    pageRaw === undefined ? 1 : Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw);
  const limit =
    limitRaw === undefined ? DEFAULT_LIMIT : Number(Array.isArray(limitRaw) ? limitRaw[0] : limitRaw);

  if (!isCalendar) {
    if (!Number.isInteger(page) || page < 1) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter page tidak valid.');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new AppError(
        400,
        ErrorCodes.EVENT_VALIDATION_FAILED,
        `Parameter limit harus 1–${MAX_LIMIT}.`,
      );
    }
  }

  const query: EventListQuery = {
    page: isCalendar ? 1 : page,
    limit: isCalendar ? CALENDAR_MAX_EVENTS : limit,
  };

  if (isCalendar) {
    query.view = 'calendar';
  }

  if (raw.type !== undefined) {
    const type = String(Array.isArray(raw.type) ? raw.type[0] : raw.type).trim() as EventType;
    if (!EVENT_TYPES.includes(type)) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter type tidak valid.');
    }
    query.type = type;
  }

  if (raw.year !== undefined) {
    const year = Number(Array.isArray(raw.year) ? raw.year[0] : raw.year);
    if (!Number.isInteger(year) || year < 1900 || year > 2100) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter year tidak valid.');
    }
    query.year = year;
  }

  if (raw.month !== undefined) {
    const month = Number(Array.isArray(raw.month) ? raw.month[0] : raw.month);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter month tidak valid.');
    }
    query.month = month;
  }

  if (raw.dateFrom !== undefined) {
    const dateFrom = String(Array.isArray(raw.dateFrom) ? raw.dateFrom[0] : raw.dateFrom);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter dateFrom tidak valid.');
    }
    query.dateFrom = dateFrom;
  }

  if (raw.dateTo !== undefined) {
    const dateTo = String(Array.isArray(raw.dateTo) ? raw.dateTo[0] : raw.dateTo);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Parameter dateTo tidak valid.');
    }
    query.dateTo = dateTo;
  }

  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
    throw new AppError(
      400,
      ErrorCodes.EVENT_VALIDATION_FAILED,
      'Parameter dateFrom tidak boleh setelah dateTo.',
    );
  }

  if (isCalendar) {
    if (!query.dateFrom || !query.dateTo) {
      throw new AppError(
        400,
        ErrorCodes.EVENT_VALIDATION_FAILED,
        'view=calendar wajib disertai dateFrom dan dateTo.',
      );
    }
    const span = inclusiveDaySpan(query.dateFrom, query.dateTo);
    if (span > CALENDAR_MAX_SPAN_DAYS) {
      throw new AppError(
        400,
        ErrorCodes.EVENT_VALIDATION_FAILED,
        `Rentang dateFrom–dateTo untuk view=calendar maksimal ${CALENDAR_MAX_SPAN_DAYS} hari.`,
      );
    }
  }

  if (raw.q !== undefined) {
    const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q).trim();
    if (q.length > 0) {
      query.q = q;
    }
  }

  return query;
}

function validateUpsertInput(input: unknown): UpsertEventInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Data acara tidak valid.');
  }

  const body = input as Record<string, unknown>;

  if (typeof body.title !== 'string' || body.title.trim().length === 0) {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Judul acara wajib diisi.');
  }
  if (body.title.trim().length > 200) {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Judul acara maksimal 200 karakter.');
  }

  if (!EVENT_TYPES.includes(body.type as EventType)) {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Tipe acara tidak valid.');
  }

  if (typeof body.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Tanggal acara tidak valid.');
  }

  if (body.endDate !== undefined && body.endDate !== null) {
    if (typeof body.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.endDate)) {
      throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'Tanggal selesai tidak valid.');
    }
  }

  const personIds = Array.isArray(body.personIds)
    ? body.personIds.filter((id): id is number => typeof id === 'number')
    : [];
  const attendeeIds = Array.isArray(body.attendeeIds)
    ? body.attendeeIds.filter((id): id is number => typeof id === 'number')
    : [];
  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];
  const mediaIds = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  return {
    title: body.title.trim(),
    type: body.type as EventType,
    date: body.date,
    endDate: (body.endDate as string | null | undefined) ?? null,
    location: typeof body.location === 'string' ? body.location : null,
    description: typeof body.description === 'string' ? body.description : null,
    personIds,
    photoUrls,
    mediaIds,
    attendeeIds,
  };
}

function validateContributionInput(input: unknown): CreateContributionInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.CONTRIBUTION_VALIDATION_FAILED, 'Data kontribusi tidak valid.');
  }

  const body = input as Record<string, unknown>;
  const photoUrl =
    typeof body.photoUrl === 'string' && body.photoUrl.trim().length > 0
      ? body.photoUrl.trim()
      : undefined;
  const mediaId =
    typeof body.mediaId === 'string' && body.mediaId.trim().length > 0
      ? body.mediaId.trim()
      : undefined;
  const mediaIds = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : mediaId
      ? [mediaId]
      : [];

  if (!photoUrl && mediaIds.length === 0) {
    throw new AppError(
      400,
      ErrorCodes.CONTRIBUTION_VALIDATION_FAILED,
      'mediaIds / mediaId / photoUrl wajib diisi.',
    );
  }

  return {
    photoUrl,
    mediaIds,
    caption: typeof body.caption === 'string' ? body.caption : null,
  };
}

function mapEventRow(
  row: EventRow,
  personIds: number[],
  attendeeIds: number[],
  photoUrls: string[],
  contributions: Awaited<ReturnType<typeof eventsRepository.findContributionsByEventIds>> extends Map<
    number,
    infer V
  >
    ? V
    : never,
  viewerPersonId: number,
): EventItem {
  const restricted = isRestrictedEvent(attendeeIds);
  const access = canAccessEvent(attendeeIds, viewerPersonId);

  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: formatDate(row.date),
    endDate: row.end_date ? formatDate(row.end_date) : null,
    location: row.location,
    description: row.description,
    personIds,
    photoUrls,
    attendeeIds,
    contributions: (contributions ?? []).map((c) => ({
      id: c.id,
      photoUrl: c.photo_url,
      contributorId: c.contributor_person_id,
      contributorName: c.contributor_name,
      caption: c.caption,
      createdAt: formatDateTime(c.created_at),
    })),
    isRestricted: restricted,
    canAccess: access,
    createdById: row.created_by_person_id,
    canManage: canManageEvent(row.created_by_person_id, viewerPersonId),
  };
}

function mapCalendarEventRow(
  row: EventRow,
  personIds: number[],
  attendeeIds: number[],
  viewerPersonId: number,
): CalendarEventItem {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    date: formatDate(row.date),
    endDate: row.end_date ? formatDate(row.end_date) : null,
    location: row.location,
    personIds,
    isRestricted: isRestrictedEvent(attendeeIds),
    canAccess: canAccessEvent(attendeeIds, viewerPersonId),
    canManage: canManageEvent(row.created_by_person_id, viewerPersonId),
  };
}

export class EventsService {
  private async assertPersonIdsInFamily(familyId: number, personIds: number[]): Promise<void> {
    for (const personId of personIds) {
      const person = await personsRepository.findById(familyId, personId);
      if (!person) {
        throw new AppError(
          400,
          ErrorCodes.EVENT_VALIDATION_FAILED,
          'Person terkait acara tidak valid atau di luar keluarga.',
        );
      }
    }
  }

  private async loadEventBundle(familyId: number, eventIds: number[]) {
    const [personMap, attendeeMap, photoMap, contributionMap] = await Promise.all([
      eventsRepository.findPersonIdsByEventIds(eventIds),
      eventsRepository.findAttendeeIdsByEventIds(eventIds),
      eventsRepository.findPhotosByEventIds(eventIds),
      eventsRepository.findContributionsByEventIds(eventIds),
    ]);
    return { personMap, attendeeMap, photoMap, contributionMap };
  }

  async list(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    queryInput: Record<string, unknown>,
  ): Promise<EventListResponse> {
    const query = parseListQuery(queryInput);
    const visibleIds = await getVisiblePersonIds(familyId, readFocus.focusPersonId, viewerId);

    const rows = await eventsRepository.findByFamily(familyId, query);
    const eventIds = rows.map((row) => row.id);

    if (query.view === 'calendar') {
      const [personMap, attendeeMap] = await Promise.all([
        eventsRepository.findPersonIdsByEventIds(eventIds),
        eventsRepository.findAttendeeIdsByEventIds(eventIds),
      ]);

      const filtered = rows.filter((row) => {
        const personIds = personMap.get(row.id) ?? [];
        return isEventVisibleInPerspective(personIds, visibleIds);
      });

      const total = filtered.length;
      const pageRows = filtered.slice(0, CALENDAR_MAX_EVENTS);
      const truncated = total > CALENDAR_MAX_EVENTS;
      const events = pageRows.map((row) =>
        mapCalendarEventRow(
          row,
          personMap.get(row.id) ?? [],
          attendeeMap.get(row.id) ?? [],
          viewerId,
        ),
      );

      return {
        ...readFocus,
        selfPersonId: viewerId,
        events,
        pagination: {
          page: 1,
          limit: pageRows.length,
          total,
          totalPages: total === 0 ? 0 : truncated ? 2 : 1,
          hasNext: truncated,
          hasPrev: false,
        },
      };
    }

    const { personMap, attendeeMap, photoMap, contributionMap } = await this.loadEventBundle(
      familyId,
      eventIds,
    );

    const filtered = rows.filter((row) => {
      const personIds = personMap.get(row.id) ?? [];
      return isEventVisibleInPerspective(personIds, visibleIds);
    });

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);
    const offset = (query.page - 1) * query.limit;
    const pageRows = filtered.slice(offset, offset + query.limit);

    const events = pageRows.map((row) =>
      mapEventRow(
        row,
        personMap.get(row.id) ?? [],
        attendeeMap.get(row.id) ?? [],
        photoMap.get(row.id) ?? [],
        contributionMap.get(row.id) ?? [],
        viewerId,
      ),
    );

    return {
      ...readFocus,
      selfPersonId: viewerId,
      events,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNext: query.page < totalPages,
        hasPrev: query.page > 1,
      },
    };
  }

  async getById(
    familyId: number,
    viewerId: number,
    eventId: number,
    readFocus: ReadFocusMeta,
  ): Promise<EventDetailResponse> {
    const row = await eventsRepository.findById(familyId, eventId);
    if (!row) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }

    const visibleIds = await getVisiblePersonIds(familyId, readFocus.focusPersonId, viewerId);
    const { personMap, attendeeMap, photoMap, contributionMap } = await this.loadEventBundle(
      familyId,
      [eventId],
    );

    const personIds = personMap.get(eventId) ?? [];
    if (!isEventVisibleInPerspective(personIds, visibleIds)) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }

    const attendeeIds = attendeeMap.get(eventId) ?? [];
    if (!canAccessEvent(attendeeIds, viewerId)) {
      throw new AppError(
        403,
        ErrorCodes.EVENT_ACCESS_FORBIDDEN,
        'Anda tidak diundang ke acara ini.',
      );
    }

    return {
      ...readFocus,
      selfPersonId: viewerId,
      event: mapEventRow(
        row,
        personIds,
        attendeeIds,
        photoMap.get(eventId) ?? [],
        contributionMap.get(eventId) ?? [],
        viewerId,
      ),
    };
  }

  async create(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<EventDetailResponse> {
    const data = validateUpsertInput(input);
    await this.assertPersonIdsInFamily(familyId, [...data.personIds ?? [], ...data.attendeeIds ?? []]);

    const resolved = await resolvePendingPhotos({
      uploaderPersonId: viewerId,
      purpose: 'event',
      mediaIds: data.mediaIds,
      photoUrls: data.photoUrls,
      maxCount: MAX_PHOTOS_BY_PURPOSE.event,
    });

    const eventId = await eventsRepository.create(familyId, viewerId, {
      ...data,
      photoUrls: resolved.photoUrls,
    });
    await attachResolvedMedia({
      mediaIds: resolved.mediaIds,
      purpose: 'event',
      attachedToId: String(eventId),
    });
    return this.getById(familyId, viewerId, eventId, readFocus);
  }

  private assertCanManageEvent(existing: EventRow, viewerId: number): void {
    if (!canManageEvent(existing.created_by_person_id, viewerId)) {
      throw new AppError(
        403,
        ErrorCodes.EVENT_MANAGE_FORBIDDEN,
        'Hanya pembuat acara yang boleh mengubah atau menghapus.',
      );
    }
  }

  async update(
    familyId: number,
    viewerId: number,
    eventId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<EventDetailResponse> {
    const existing = await eventsRepository.findById(familyId, eventId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }
    this.assertCanManageEvent(existing, viewerId);

    const data = validateUpsertInput(input);
    await this.assertPersonIdsInFamily(familyId, [...data.personIds ?? [], ...data.attendeeIds ?? []]);

    const resolved = await resolvePendingPhotos({
      uploaderPersonId: viewerId,
      purpose: 'event',
      mediaIds: data.mediaIds,
      photoUrls: data.photoUrls,
      maxCount: MAX_PHOTOS_BY_PURPOSE.event,
    });

    await eventsRepository.update(familyId, eventId, {
      ...data,
      photoUrls: resolved.photoUrls,
    });
    await attachResolvedMedia({
      mediaIds: resolved.mediaIds,
      purpose: 'event',
      attachedToId: String(eventId),
    });
    return this.getById(familyId, viewerId, eventId, readFocus);
  }

  async remove(familyId: number, viewerId: number, eventId: number): Promise<void> {
    const existing = await eventsRepository.findById(familyId, eventId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }
    this.assertCanManageEvent(existing, viewerId);
    await eventsRepository.softDelete(familyId, eventId);
  }

  async addContribution(
    familyId: number,
    viewerId: number,
    eventId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<EventDetailResponse> {
    const row = await eventsRepository.findById(familyId, eventId);
    if (!row) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }

    const { attendeeMap } = await this.loadEventBundle(familyId, [eventId]);
    const attendeeIds = attendeeMap.get(eventId) ?? [];
    if (!canAccessEvent(attendeeIds, viewerId)) {
      throw new AppError(
        403,
        ErrorCodes.EVENT_ACCESS_FORBIDDEN,
        'Anda tidak diundang ke acara ini.',
      );
    }

    const data = validateContributionInput(input);
    const resolved = await resolvePendingPhotos({
      uploaderPersonId: viewerId,
      purpose: 'event_contribution',
      mediaIds: data.mediaIds,
      photoUrls: data.photoUrl ? [data.photoUrl] : [],
      maxCount: MAX_PHOTOS_BY_PURPOSE.event_contribution,
      requireAtLeastOne: true,
      requireManaged: true,
      emptyErrorCode: ErrorCodes.CONTRIBUTION_VALIDATION_FAILED,
      emptyErrorMessage: 'mediaIds / mediaId / photoUrl wajib diisi.',
    });

    for (const [index, photoUrl] of resolved.photoUrls.entries()) {
      const contributionId = await eventsRepository.insertContribution(
        eventId,
        viewerId,
        photoUrl,
        data.caption ?? null,
      );
      const mediaId = resolved.mediaIds[index];
      if (mediaId) {
        await attachResolvedMedia({
          mediaIds: [mediaId],
          purpose: 'event_contribution',
          attachedToId: String(contributionId),
        });
      }
    }

    return this.getById(familyId, viewerId, eventId, readFocus);
  }
}

export const eventsService = new EventsService();
