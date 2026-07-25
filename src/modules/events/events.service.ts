import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { formatBirthDate } from '../auth/auth.mapper';
import { getVisiblePersonIds } from '../persons/perspective-subgraph.service';
import { personsRepository } from '../persons/persons.repository';
import { ReadFocusMeta } from '../persons/persons.types';
import {
  canAccessEvent,
  isEventVisibleInPerspective,
  isRestrictedEvent,
} from './event-access.service';
import { eventsRepository } from './events.repository';
import {
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

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return formatBirthDate(value);
  }
  return value.slice(0, 10);
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

function parseListQuery(raw: Record<string, unknown>): EventListQuery {
  const pageRaw = raw.page;
  const limitRaw = raw.limit;

  const page =
    pageRaw === undefined ? 1 : Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw);
  const limit =
    limitRaw === undefined ? DEFAULT_LIMIT : Number(Array.isArray(limitRaw) ? limitRaw[0] : limitRaw);

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

  const query: EventListQuery = { page, limit };

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

  return {
    title: body.title.trim(),
    type: body.type as EventType,
    date: body.date,
    endDate: (body.endDate as string | null | undefined) ?? null,
    location: typeof body.location === 'string' ? body.location : null,
    description: typeof body.description === 'string' ? body.description : null,
    personIds,
    photoUrls,
    attendeeIds,
  };
}

function validateContributionInput(input: unknown): CreateContributionInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.CONTRIBUTION_VALIDATION_FAILED, 'Data kontribusi tidak valid.');
  }

  const body = input as Record<string, unknown>;
  if (typeof body.photoUrl !== 'string' || body.photoUrl.trim().length === 0) {
    throw new AppError(
      400,
      ErrorCodes.CONTRIBUTION_VALIDATION_FAILED,
      'URL foto kontribusi wajib diisi.',
    );
  }

  return {
    photoUrl: body.photoUrl.trim(),
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

    const eventId = await eventsRepository.create(familyId, viewerId, data);
    return this.getById(familyId, viewerId, eventId, readFocus);
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

    const data = validateUpsertInput(input);
    await this.assertPersonIdsInFamily(familyId, [...data.personIds ?? [], ...data.attendeeIds ?? []]);
    await eventsRepository.update(familyId, eventId, data);
    return this.getById(familyId, viewerId, eventId, readFocus);
  }

  async remove(familyId: number, eventId: number): Promise<void> {
    const existing = await eventsRepository.findById(familyId, eventId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.EVENT_NOT_FOUND, 'Acara tidak ditemukan.');
    }
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
    await eventsRepository.insertContribution(eventId, viewerId, data.photoUrl, data.caption ?? null);
    return this.getById(familyId, viewerId, eventId, readFocus);
  }
}

export const eventsService = new EventsService();
