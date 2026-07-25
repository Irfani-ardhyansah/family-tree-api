import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { getVisiblePersonIds } from '../persons/perspective-subgraph.service';
import { mapPersonRowToResponse, personsRepository } from '../persons/persons.repository';
import { ReadFocusMeta } from '../persons/persons.types';
import { sanitizeMemorialHtml } from './html-sanitize.service';
import {
  canAccessMemorial,
  isDeceasedVisibleInPerspective,
} from './memoriam-access.service';
import { memoriamRepository } from './memoriam.repository';
import {
  CreateTributeInput,
  DeceasedDetailResponse,
  DeceasedListItem,
  DeceasedListQuery,
  DeceasedListResponse,
  PrayerListResponse,
  PrayerMeResponse,
  TributeListResponse,
} from './memoriam.types';

const MAX_TRIBUTE_PHOTOS = 8;

function parseListQuery(raw: Record<string, unknown>): DeceasedListQuery {
  const query: DeceasedListQuery = {};

  if (raw.q !== undefined) {
    const q = String(Array.isArray(raw.q) ? raw.q[0] : raw.q).trim();
    if (q.length > 0) {
      query.q = q;
    }
  }

  if (raw.deathYear !== undefined) {
    const deathYear = Number(Array.isArray(raw.deathYear) ? raw.deathYear[0] : raw.deathYear);
    if (!Number.isInteger(deathYear) || deathYear < 1900 || deathYear > 2100) {
      throw new AppError(
        400,
        ErrorCodes.TRIBUTE_VALIDATION_FAILED,
        'Parameter deathYear tidak valid.',
      );
    }
    query.deathYear = deathYear;
  }

  return query;
}

function validateTributeInput(input: unknown): CreateTributeInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.TRIBUTE_VALIDATION_FAILED, 'Data tribute tidak valid.');
  }

  const body = input as Record<string, unknown>;
  if (typeof body.content !== 'string' || body.content.trim().length === 0) {
    throw new AppError(400, ErrorCodes.TRIBUTE_VALIDATION_FAILED, 'Isi tribute wajib diisi.');
  }

  const photoUrls = Array.isArray(body.photoUrls)
    ? body.photoUrls.filter((url): url is string => typeof url === 'string' && url.length > 0)
    : [];

  if (photoUrls.length > MAX_TRIBUTE_PHOTOS) {
    throw new AppError(
      400,
      ErrorCodes.TRIBUTE_VALIDATION_FAILED,
      `Maksimal ${MAX_TRIBUTE_PHOTOS} foto per tribute.`,
    );
  }

  return {
    content: sanitizeMemorialHtml(body.content.trim()),
    photoUrls,
  };
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

export class MemoriamService {
  private async loadGraphContext(familyId: number) {
    const [graph, pairs] = await Promise.all([
      personsRepository.findGraphNodes(familyId),
      personsRepository.findSpousePairs(familyId),
    ]);
    const spouseMap = personsRepository.buildSpouseMap(pairs);
    return { graph, spouseMap };
  }

  private async assertDeceasedAccess(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ) {
    const row = await personsRepository.findById(familyId, deceasedId);
    if (!row || row.status !== 'deceased') {
      throw new AppError(400, ErrorCodes.MEMORIAL_NOT_DECEASED, 'Person bukan mendiang.');
    }

    const { graph } = await this.loadGraphContext(familyId);
    if (!canAccessMemorial(viewerId, deceasedId, graph)) {
      throw new AppError(
        403,
        ErrorCodes.MEMORIAL_ACCESS_FORBIDDEN,
        'Anda tidak terhubung dengan mendiang ini.',
      );
    }

    const visibleIds = await getVisiblePersonIds(familyId, readFocus.focusPersonId, viewerId);
    if (!isDeceasedVisibleInPerspective(deceasedId, readFocus.focusPersonId, visibleIds, graph)) {
      throw new AppError(
        403,
        ErrorCodes.MEMORIAL_ACCESS_FORBIDDEN,
        'Mendiang tidak ada dalam lingkup perspektif saat ini.',
      );
    }

    return { row, graph, spouseMap: personsRepository.buildSpouseMap(await personsRepository.findSpousePairs(familyId)) };
  }

  private mapDeceasedItem(
    row: Awaited<ReturnType<typeof personsRepository.findById>> & object,
    viewerId: number,
    focusPersonId: number,
    graph: Awaited<ReturnType<typeof personsRepository.findGraphNodes>>,
    spouseIds: number[],
    tributeCount: number,
    prayerCount: number,
  ): DeceasedListItem {
    const mapped = mapPersonRowToResponse(row, viewerId, focusPersonId, graph, spouseIds);
    return {
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
      prayerCount,
    };
  }

  async listDeceased(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    queryInput: Record<string, unknown>,
  ): Promise<DeceasedListResponse> {
    const query = parseListQuery(queryInput);
    const { graph, spouseMap } = await this.loadGraphContext(familyId);
    const visibleIds = await getVisiblePersonIds(familyId, readFocus.focusPersonId, viewerId);

    const allRows = await personsRepository.findAllByFamily(familyId);
    const deceasedRows = allRows.filter((row) => row.status === 'deceased');

    const eligible = deceasedRows.filter((row) => {
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

    let filtered = eligible;
    if (query.deathYear) {
      filtered = filtered.filter((row) => {
        if (!row.death_date) {
          return false;
        }
        const year = new Date(row.death_date).getFullYear();
        return year === query.deathYear;
      });
    }
    if (query.q) {
      const needle = query.q.toLowerCase();
      filtered = filtered.filter((row) =>
        row.full_name.toLowerCase().includes(needle) ||
        (row.nickname?.toLowerCase().includes(needle) ?? false),
      );
    }

    const deceasedIds = filtered.map((row) => row.id);
    const [tributeCounts, prayerCounts] = await Promise.all([
      memoriamRepository.countTributesByDeceasedIds(deceasedIds),
      memoriamRepository.countPrayersByDeceasedIds(deceasedIds),
    ]);

    const deceased = filtered.map((row) =>
      this.mapDeceasedItem(
        row,
        viewerId,
        readFocus.focusPersonId,
        graph,
        spouseMap.get(row.id) ?? [],
        tributeCounts.get(row.id) ?? 0,
        prayerCounts.get(row.id) ?? 0,
      ),
    );

    return {
      ...readFocus,
      selfPersonId: viewerId,
      deceased,
    };
  }

  async getDeceasedById(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ): Promise<DeceasedDetailResponse> {
    const { row, graph, spouseMap } = await this.assertDeceasedAccess(
      familyId,
      viewerId,
      deceasedId,
      readFocus,
    );

    const [tributeCounts, prayerCounts] = await Promise.all([
      memoriamRepository.countTributesByDeceasedIds([deceasedId]),
      memoriamRepository.countPrayersByDeceasedIds([deceasedId]),
    ]);

    return {
      ...readFocus,
      selfPersonId: viewerId,
      deceased: this.mapDeceasedItem(
        row,
        viewerId,
        readFocus.focusPersonId,
        graph,
        spouseMap.get(row.id) ?? [],
        tributeCounts.get(deceasedId) ?? 0,
        prayerCounts.get(deceasedId) ?? 0,
      ),
    };
  }

  async listTributes(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ): Promise<TributeListResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);

    const rows = await memoriamRepository.findTributes(familyId, deceasedId);
    const tributeIds = rows.map((row) => row.id);
    const photoMap = await memoriamRepository.findTributePhotosByTributeIds(tributeIds);

    return {
      ...readFocus,
      selfPersonId: viewerId,
      tributes: rows.map((row) => ({
        id: row.id,
        content: row.content,
        authorId: row.author_person_id,
        authorName: row.author_name,
        photoUrls: photoMap.get(row.id) ?? [],
        createdAt: formatDateTime(row.created_at),
        updatedAt: row.updated_at ? formatDateTime(row.updated_at) : null,
      })),
    };
  }

  async createTribute(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<TributeListResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);
    const data = validateTributeInput(input);
    await memoriamRepository.createTribute(familyId, deceasedId, viewerId, data);
    return this.listTributes(familyId, viewerId, deceasedId, readFocus);
  }

  async listPrayers(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ): Promise<PrayerListResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);

    const rows = await memoriamRepository.findPrayers(familyId, deceasedId);
    return {
      ...readFocus,
      selfPersonId: viewerId,
      prayers: rows.map((row) => ({
        id: row.id,
        authorId: row.author_person_id,
        authorName: row.author_name,
        createdAt: formatDateTime(row.created_at),
      })),
    };
  }

  async recordPrayer(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ): Promise<{ response: PrayerListResponse; created: boolean }> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);

    const existing = await memoriamRepository.findPrayerByAuthor(deceasedId, viewerId);
    if (existing) {
      return {
        response: await this.listPrayers(familyId, viewerId, deceasedId, readFocus),
        created: false,
      };
    }

    await memoriamRepository.insertPrayer(familyId, deceasedId, viewerId);
    return {
      response: await this.listPrayers(familyId, viewerId, deceasedId, readFocus),
      created: true,
    };
  }

  async getPrayerMe(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
  ): Promise<PrayerMeResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);
    const existing = await memoriamRepository.findPrayerByAuthor(deceasedId, viewerId);

    return {
      ...readFocus,
      selfPersonId: viewerId,
      hasPrayed: Boolean(existing),
    };
  }
}

export const memoriamService = new MemoriamService();
