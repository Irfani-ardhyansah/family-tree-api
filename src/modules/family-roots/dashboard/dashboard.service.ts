import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { formatBirthDate } from '../../core/auth/auth.mapper';
import {
  canAccessEvent,
  canManageEvent,
  isEventVisibleInPerspective,
  isRestrictedEvent,
} from '../events/event-access.service';
import { eventsRepository } from '../events/events.repository';
import { EventItem, EventRow } from '../events/events.types';
import {
  canAccessMemorial,
  isDeceasedVisibleInPerspective,
} from '../memoriam/memoriam-access.service';
import { memoriamRepository } from '../memoriam/memoriam.repository';
import { PERSPECTIVE_VIEW_DEFAULTS } from '../persons/perspective-subgraph.service';
import { mapPersonRowToResponse, personsRepository } from '../persons/persons.repository';
import { PersonRow, ReadFocusMeta } from '../persons/persons.types';
import { filterTreeSubgraph } from '../persons/tree-subgraph.service';
import { countDistinctGenerations } from './dashboard.stats';
import {
  DashboardFocusPerson,
  DashboardMemoriamItem,
  DashboardQuery,
  DashboardResponse,
} from './dashboard.types';

const DEFAULT_RECENT_LIMIT = 5;
const DEFAULT_UPCOMING_LIMIT = 3;
const DEFAULT_MEMORIAM_LIMIT = 4;
const MAX_SLICE_LIMIT = 20;

function formatDate(value: Date | string): string {
  if (value instanceof Date) {
    return formatBirthDate(value);
  }
  return value.slice(0, 10);
}

function formatDateTime(value: Date | string): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return new Date(value).toISOString();
}

function todayIsoDate(): string {
  return formatBirthDate(new Date());
}

function parseLimit(raw: unknown, field: string, defaultValue: number): number {
  if (raw === undefined) {
    return defaultValue;
  }
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value < 1 || value > MAX_SLICE_LIMIT) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      `Parameter ${field} harus 1–${MAX_SLICE_LIMIT}.`,
    );
  }
  return value;
}

function parseDashboardQuery(raw: Record<string, unknown>): DashboardQuery {
  return {
    recentLimit: parseLimit(raw.recentLimit, 'recentLimit', DEFAULT_RECENT_LIMIT),
    upcomingLimit: parseLimit(raw.upcomingLimit, 'upcomingLimit', DEFAULT_UPCOMING_LIMIT),
    memoriamLimit: parseLimit(raw.memoriamLimit, 'memoriamLimit', DEFAULT_MEMORIAM_LIMIT),
  };
}

function mapFocusPerson(row: PersonRow): DashboardFocusPerson {
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    photoUrl: row.photo_url,
    gender: row.gender,
  };
}

function mapEventItem(
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
    isRestricted: isRestrictedEvent(attendeeIds),
    canAccess: canAccessEvent(attendeeIds, viewerPersonId),
    createdById: row.created_by_person_id,
    canManage: canManageEvent(row.created_by_person_id, viewerPersonId),
  };
}

function compareEventDateDesc(a: EventRow, b: EventRow): number {
  const dateCmp = formatDate(b.date).localeCompare(formatDate(a.date));
  if (dateCmp !== 0) {
    return dateCmp;
  }
  return b.id - a.id;
}

function compareEventDateAsc(a: EventRow, b: EventRow): number {
  const dateCmp = formatDate(a.date).localeCompare(formatDate(b.date));
  if (dateCmp !== 0) {
    return dateCmp;
  }
  return a.id - b.id;
}

export class DashboardService {
  async get(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    queryInput: Record<string, unknown>,
  ): Promise<DashboardResponse> {
    try {
      const query = parseDashboardQuery(queryInput);
      const today = todayIsoDate();

      const [allRows, pairs, eventRows] = await Promise.all([
        personsRepository.findAllByFamily(familyId),
        personsRepository.findSpousePairs(familyId),
        eventsRepository.findByFamily(familyId, {}),
      ]);

      const spouseMap = personsRepository.buildSpouseMap(pairs);
      const graph = allRows.map((row) => ({
        id: row.id,
        gender: row.gender,
        fatherId: row.father_id,
        motherId: row.mother_id,
        spouseIds: spouseMap.get(row.id) ?? [],
      }));

      const { visibleIds } = filterTreeSubgraph(
        readFocus.focusPersonId,
        viewerId,
        graph,
        PERSPECTIVE_VIEW_DEFAULTS,
      );

      const focusRow = allRows.find((row) => row.id === readFocus.focusPersonId);
      if (!focusRow) {
        throw new AppError(
          500,
          ErrorCodes.DASHBOARD_LOAD_FAILED,
          'Fokus orang tidak ditemukan di keluarga.',
        );
      }

      const eventIds = eventRows.map((row) => row.id);
      const [personMap, attendeeMap, photoMap] = await Promise.all([
        eventsRepository.findPersonIdsByEventIds(eventIds),
        eventsRepository.findAttendeeIdsByEventIds(eventIds),
        eventsRepository.findPhotosByEventIds(eventIds),
      ]);

      const visibleEvents = eventRows.filter((row) =>
        isEventVisibleInPerspective(personMap.get(row.id) ?? [], visibleIds),
      );

      const upcomingAll = visibleEvents
        .filter((row) => formatDate(row.date) >= today)
        .sort(compareEventDateAsc);

      const recentAll = [...visibleEvents].sort(compareEventDateDesc);

      const recentRows = recentAll.slice(0, query.recentLimit);
      const upcomingRows = upcomingAll.slice(0, query.upcomingLimit);
      const slicedIds = [...new Set([...recentRows, ...upcomingRows].map((row) => row.id))];

      const contributionMap = await eventsRepository.findContributionsByEventIds(slicedIds);

      const toEventItem = (row: EventRow): EventItem =>
        mapEventItem(
          row,
          personMap.get(row.id) ?? [],
          attendeeMap.get(row.id) ?? [],
          photoMap.get(row.id) ?? [],
          contributionMap.get(row.id) ?? [],
          viewerId,
        );

      const visiblePersonRows = allRows.filter((row) => visibleIds.has(row.id));
      const personPhotoCount = visiblePersonRows.filter((row) => Boolean(row.photo_url)).length;
      const eventPhotoCount = visibleEvents.reduce(
        (sum, row) => sum + (photoMap.get(row.id)?.length ?? 0),
        0,
      );

      const deceasedEligible = allRows.filter((row) => {
        if (row.status !== 'deceased') {
          return false;
        }
        if (!canAccessMemorial(viewerId, row.id, graph)) {
          return false;
        }
        return isDeceasedVisibleInPerspective(
          row.id,
          readFocus.focusPersonId,
          visibleIds,
          graph,
        );
      });

      const deceasedIds = deceasedEligible.map((row) => row.id);
      const [tributeCounts, prayerCounts, latestTributeAtMap] = await Promise.all([
        memoriamRepository.countTributesByDeceasedIds(deceasedIds),
        memoriamRepository.countPrayersByDeceasedIds(deceasedIds),
        memoriamRepository.findLatestTributeAtByDeceasedIds(deceasedIds),
      ]);

      const recentMemoriamCandidates = deceasedEligible
        .map((row) => {
          const tributeCount = tributeCounts.get(row.id) ?? 0;
          const latestAt = latestTributeAtMap.get(row.id) ?? null;
          const mapped = mapPersonRowToResponse(
            row,
            viewerId,
            readFocus.focusPersonId,
            graph,
            spouseMap.get(row.id) ?? [],
          );
          const item: DashboardMemoriamItem = {
            id: mapped.id,
            fullName: mapped.fullName,
            nickname: mapped.nickname,
            gender: mapped.gender,
            birthDate: mapped.birthDate,
            deathDate: mapped.deathDate,
            status: 'deceased',
            photoUrl: mapped.photoUrl,
            generationLabel: mapped.generationLabel,
            religion: mapped.religion,
            tributeCount,
            prayerCount: prayerCounts.get(row.id) ?? 0,
            canAccess: true,
            latestTributeAt: latestAt ? formatDateTime(latestAt) : null,
          };
          return item;
        })
        .filter((item) => item.tributeCount > 0)
        .sort((a, b) => {
          if (a.latestTributeAt && b.latestTributeAt) {
            const cmp = b.latestTributeAt.localeCompare(a.latestTributeAt);
            if (cmp !== 0) {
              return cmp;
            }
          } else if (a.latestTributeAt) {
            return -1;
          } else if (b.latestTributeAt) {
            return 1;
          }

          const deathA = a.deathDate ?? '';
          const deathB = b.deathDate ?? '';
          return deathB.localeCompare(deathA);
        });

      return {
        ...readFocus,
        selfPersonId: viewerId,
        focusPerson: mapFocusPerson(focusRow),
        stats: {
          memberCount: visibleIds.size,
          generationCount: countDistinctGenerations(
            readFocus.focusPersonId,
            visibleIds,
            graph,
          ),
          photoCount: personPhotoCount + eventPhotoCount,
          upcomingEventCount: upcomingAll.length,
        },
        recentEvents: recentRows.map(toEventItem),
        upcomingEvents: upcomingRows.map(toEventItem),
        recentMemoriam: recentMemoriamCandidates.slice(0, query.memoriamLimit),
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        500,
        ErrorCodes.DASHBOARD_LOAD_FAILED,
        'Gagal memuat ringkasan dashboard.',
      );
    }
  }
}

export const dashboardService = new DashboardService();
