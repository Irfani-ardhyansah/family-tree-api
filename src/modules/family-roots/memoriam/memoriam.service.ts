import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  attachResolvedMedia,
  resolvePendingPhotos,
} from '../../core/media/media.attach.service';
import { MAX_PHOTOS_BY_PURPOSE } from '../../core/media/media.constants';
import { getVisiblePersonIds } from '../persons/perspective-subgraph.service';
import { mapPersonRowToResponse, personsRepository } from '../persons/persons.repository';
import { ReadFocusMeta } from '../persons/persons.types';
import { sanitizeMemorialHtml } from './html-sanitize.service';
import {
  canAccessMemorial,
  canManageTribute,
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
  TributeDetailResponse,
  TributeItem,
  TributeListResponse,
  TributeRow,
} from './memoriam.types';

const MAX_TRIBUTE_PHOTOS = MAX_PHOTOS_BY_PURPOSE.memoriam_tribute;

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
  const mediaIds = Array.isArray(body.mediaIds)
    ? body.mediaIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (photoUrls.length > MAX_TRIBUTE_PHOTOS || mediaIds.length > MAX_TRIBUTE_PHOTOS) {
    throw new AppError(
      400,
      ErrorCodes.TRIBUTE_VALIDATION_FAILED,
      `Maksimal ${MAX_TRIBUTE_PHOTOS} foto per tribute.`,
    );
  }

  return {
    content: sanitizeMemorialHtml(body.content.trim()),
    photoUrls,
    mediaIds,
  };
}

function formatDateTime(value: Date): string {
  return value.toISOString();
}

function mapTributeItem(
  row: TributeRow,
  photoUrls: string[],
  viewerPersonId: number,
): TributeItem {
  return {
    id: row.id,
    deceasedId: row.deceased_person_id,
    content: row.content,
    authorId: row.author_person_id,
    authorName: row.author_name,
    photoUrls,
    createdAt: formatDateTime(row.created_at),
    updatedAt: formatDateTime(row.updated_at),
    canManage: canManageTribute(row.author_person_id, viewerPersonId),
  };
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

  private assertCanManageTribute(row: TributeRow, viewerId: number): void {
    if (!canManageTribute(row.author_person_id, viewerId)) {
      throw new AppError(
        403,
        ErrorCodes.TRIBUTE_MANAGE_FORBIDDEN,
        'Hanya penulis tribute yang boleh mengubah atau menghapus.',
      );
    }
  }

  private async getTributeDetail(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    tributeId: number,
    readFocus: ReadFocusMeta,
  ): Promise<TributeDetailResponse> {
    const row = await memoriamRepository.findTributeById(familyId, deceasedId, tributeId);
    if (!row) {
      throw new AppError(404, ErrorCodes.TRIBUTE_NOT_FOUND, 'Tribute tidak ditemukan.');
    }

    const photoMap = await memoriamRepository.findTributePhotosByTributeIds([tributeId]);
    return {
      ...readFocus,
      selfPersonId: viewerId,
      tribute: mapTributeItem(row, photoMap.get(tributeId) ?? [], viewerId),
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
      tributes: rows.map((row) =>
        mapTributeItem(row, photoMap.get(row.id) ?? [], viewerId),
      ),
    };
  }

  async createTribute(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<TributeDetailResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);
    const data = validateTributeInput(input);

    const resolved = await resolvePendingPhotos({
      uploaderPersonId: viewerId,
      purpose: 'memoriam_tribute',
      mediaIds: data.mediaIds,
      photoUrls: data.photoUrls,
      maxCount: MAX_TRIBUTE_PHOTOS,
    });

    const tributeId = await memoriamRepository.createTribute(familyId, deceasedId, viewerId, {
      ...data,
      photoUrls: resolved.photoUrls,
    });
    await attachResolvedMedia({
      mediaIds: resolved.mediaIds,
      purpose: 'memoriam_tribute',
      attachedToId: String(tributeId),
    });

    return this.getTributeDetail(familyId, viewerId, deceasedId, tributeId, readFocus);
  }

  async updateTribute(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    tributeId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<TributeDetailResponse> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);

    const existing = await memoriamRepository.findTributeById(familyId, deceasedId, tributeId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.TRIBUTE_NOT_FOUND, 'Tribute tidak ditemukan.');
    }
    this.assertCanManageTribute(existing, viewerId);

    const data = validateTributeInput(input);
    const resolved = await resolvePendingPhotos({
      uploaderPersonId: viewerId,
      purpose: 'memoriam_tribute',
      mediaIds: data.mediaIds,
      photoUrls: data.photoUrls,
      maxCount: MAX_TRIBUTE_PHOTOS,
    });

    await memoriamRepository.updateTribute(familyId, deceasedId, tributeId, {
      ...data,
      photoUrls: resolved.photoUrls,
    });
    await attachResolvedMedia({
      mediaIds: resolved.mediaIds,
      purpose: 'memoriam_tribute',
      attachedToId: String(tributeId),
    });

    return this.getTributeDetail(familyId, viewerId, deceasedId, tributeId, readFocus);
  }

  async removeTribute(
    familyId: number,
    viewerId: number,
    deceasedId: number,
    tributeId: number,
    readFocus: ReadFocusMeta,
  ): Promise<void> {
    await this.assertDeceasedAccess(familyId, viewerId, deceasedId, readFocus);

    const existing = await memoriamRepository.findTributeById(familyId, deceasedId, tributeId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.TRIBUTE_NOT_FOUND, 'Tribute tidak ditemukan.');
    }
    this.assertCanManageTribute(existing, viewerId);
    await memoriamRepository.softDeleteTribute(familyId, deceasedId, tributeId);
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
