import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { authRepository } from '../auth/auth.repository';
import { isLegalAge, formatBirthDate } from '../auth/auth.mapper';
import {
  collectFocusBranchIds,
  computeMaxAncestorDepth,
  filterRowsByBranch,
} from './focus-branch.service';
import { buildReadFocusMeta } from './read-focus.service';
import {
  hasAnyAddress,
  hasCityLevel,
  hasExactCoords,
  matchesMapFilters,
  parseMapQuery,
  validatePatchAddressInput,
} from './person-map.service';
import {
  getVisiblePersonIds,
  PERSPECTIVE_VIEW_DEFAULTS,
} from './perspective-subgraph.service';
import { mapPersonRowToResponse, personsRepository } from './persons.repository';
import {
  CLIENT_FILTER_RECOMMEND_THRESHOLD,
  parseTreeFilterQuery,
} from './tree-filter-query.service';
import { filterTreeSubgraph } from './tree-subgraph.service';
import {
  PersonGraphNode,
  PersonListQuery,
  PersonListResponse,
  PersonMapResponse,
  PersonReadResponse,
  ReadFocusMeta,
  UpsertPersonInput,
} from './persons.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function validateUpsertInput(input: unknown): UpsertPersonInput {
  if (!input || typeof input !== 'object') {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Data person tidak valid.');
  }

  const body = input as Record<string, unknown>;

  if (typeof body.fullName !== 'string' || body.fullName.trim().length === 0) {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Nama lengkap wajib diisi.');
  }

  if (body.gender !== 'male' && body.gender !== 'female') {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Gender tidak valid.');
  }

  if (typeof body.birthDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.birthDate)) {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Tanggal lahir tidak valid.');
  }

  if (body.deathDate !== undefined && body.deathDate !== null) {
    if (typeof body.deathDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(body.deathDate)) {
      throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Tanggal meninggal tidak valid.');
    }
  }

  if (body.status !== undefined && body.status !== 'alive' && body.status !== 'deceased') {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Status tidak valid.');
  }

  return {
    fullName: body.fullName.trim(),
    nickname: typeof body.nickname === 'string' ? body.nickname : null,
    gender: body.gender,
    birthDate: body.birthDate,
    deathDate: (body.deathDate as string | null | undefined) ?? null,
    status: (body.status as 'alive' | 'deceased' | undefined) ?? 'alive',
    religion: body.religion === 'islam' || body.religion === 'other' ? body.religion : null,
    photoUrl: typeof body.photoUrl === 'string' ? body.photoUrl : null,
    occupation: typeof body.occupation === 'string' ? body.occupation : null,
    phone: typeof body.phone === 'string' ? body.phone : null,
    phoneAlt: typeof body.phoneAlt === 'string' ? body.phoneAlt : null,
    address: (body.address as UpsertPersonInput['address']) ?? null,
    fatherId: typeof body.fatherId === 'number' ? body.fatherId : null,
    motherId: typeof body.motherId === 'number' ? body.motherId : null,
    spouseIds: Array.isArray(body.spouseIds)
      ? body.spouseIds.filter((id): id is number => typeof id === 'number')
      : undefined,
    role: body.role === 'admin' || body.role === 'member' ? body.role : undefined,
  };
}

function parseListQuery(raw: Record<string, unknown>): PersonListQuery {
  const pageRaw = raw.page;
  const limitRaw = raw.limit;
  const viewRaw = raw.view;

  const page =
    pageRaw === undefined
      ? 1
      : Number(Array.isArray(pageRaw) ? pageRaw[0] : pageRaw);
  const limit =
    limitRaw === undefined
      ? DEFAULT_LIMIT
      : Number(Array.isArray(limitRaw) ? limitRaw[0] : limitRaw);
  const view = viewRaw === 'tree' ? 'tree' : 'list';

  if (!Number.isInteger(page) || page < 1) {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'Parameter page tidak valid.');
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new AppError(
      400,
      ErrorCodes.PERSON_VALIDATION_FAILED,
      `Parameter limit harus 1–${MAX_LIMIT}.`,
    );
  }

  return { page, limit, view };
}

export class PersonsService {
  private async loadGraphContext(familyId: number) {
    const [graph, pairs, rootPersonId] = await Promise.all([
      personsRepository.findGraphNodes(familyId),
      personsRepository.findSpousePairs(familyId),
      personsRepository.getRootPersonId(familyId),
    ]);

    const spouseMap = personsRepository.buildSpouseMap(pairs);
    return { graph, spouseMap, rootPersonId };
  }

  private async defaultReadFocus(viewerId: number): Promise<ReadFocusMeta> {
    const spouseIds = await authRepository.findSpouseIdsByPersonId(viewerId);
    return buildReadFocusMeta(viewerId, spouseIds);
  }

  private async loadBranchRows(familyId: number, focusPersonId: number, graph: PersonGraphNode[]) {
    const branchIds = collectFocusBranchIds(focusPersonId, graph);
    const allRows = await personsRepository.findAllByFamily(familyId);
    return filterRowsByBranch(allRows, branchIds);
  }

  private paginateRows<T>(rows: T[], page: number, limit: number) {
    const total = rows.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const offset = (page - 1) * limit;

    return {
      rows: rows.slice(offset, offset + limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  private mapRows(
    rows: Awaited<ReturnType<typeof personsRepository.findAllByFamily>>,
    viewerId: number,
    labelPerspectiveId: number,
    graph: Awaited<ReturnType<typeof personsRepository.findGraphNodes>>,
    spouseMap: Map<number, number[]>,
  ) {
    return rows.map((row) =>
      mapPersonRowToResponse(
        row,
        viewerId,
        labelPerspectiveId,
        graph,
        spouseMap.get(row.id) ?? [],
      ),
    );
  }

  async list(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    queryInput: Record<string, unknown> = {},
  ): Promise<PersonListResponse> {
    const query = parseListQuery(queryInput);
    const { graph, spouseMap, rootPersonId } = await this.loadGraphContext(familyId);
    const labelPerspectiveId = readFocus.focusPersonId;

    if (query.view === 'tree') {
      const allRows = await personsRepository.findAllByFamily(familyId);
      const totalFamilyCount = allRows.length;
      const { filter: treeFilter, applied: filterApplied } = parseTreeFilterQuery(queryInput);

      let visibleIds: Set<number>;
      let graphWarnings: string[] = [];
      let maxAncestorDepth: number;

      if (filterApplied) {
        const subgraph = filterTreeSubgraph(
          labelPerspectiveId,
          viewerId,
          graph,
          treeFilter,
        );
        visibleIds = subgraph.visibleIds;
        graphWarnings = subgraph.graphWarnings;
        maxAncestorDepth = subgraph.maxAncestorDepth;
      } else {
        visibleIds = new Set(graph.map((node) => node.id));
        maxAncestorDepth = computeMaxAncestorDepth(labelPerspectiveId, graph);
      }

      const visibleRows = allRows.filter((row) => visibleIds.has(row.id));

      return {
        ...readFocus,
        view: 'tree',
        selfPersonId: viewerId,
        rootPersonId: labelPerspectiveId,
        persons: this.mapRows(visibleRows, viewerId, labelPerspectiveId, graph, spouseMap),
        treeGraph: {
          anchorPersonId: labelPerspectiveId,
          edgeFields: {
            parent: ['fatherId', 'motherId'],
            spouse: 'spouseIds',
          },
        },
        filter: {
          ...treeFilter,
          applied: filterApplied,
        },
        meta: {
          personCount: visibleRows.length,
          totalFamilyCount,
          maxAncestorDepth,
          filtered: filterApplied,
          recommendClientFilter: totalFamilyCount >= CLIENT_FILTER_RECOMMEND_THRESHOLD,
        },
        graphWarnings,
      };
    }

    const branchRows = await this.loadBranchRows(familyId, labelPerspectiveId, graph);
    const { rows, pagination } = this.paginateRows(branchRows, query.page!, query.limit!);

    return {
      ...readFocus,
      view: 'list',
      rootPersonId,
      persons: this.mapRows(rows, viewerId, labelPerspectiveId, graph, spouseMap),
      pagination,
    };
  }

  async getById(
    familyId: number,
    viewerId: number,
    personId: number,
    readFocus: ReadFocusMeta,
  ): Promise<PersonReadResponse> {
    const [row, { graph, spouseMap }] = await Promise.all([
      personsRepository.findById(familyId, personId),
      this.loadGraphContext(familyId),
    ]);

    if (!row) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    const branchIds = collectFocusBranchIds(readFocus.focusPersonId, graph);
    if (!branchIds.has(personId)) {
      throw new AppError(
        404,
        ErrorCodes.PERSON_NOT_FOUND,
        'Person tidak ada dalam cabang fokus saat ini.',
      );
    }

    return {
      ...readFocus,
      ...mapPersonRowToResponse(
        row,
        viewerId,
        readFocus.focusPersonId,
        graph,
        spouseMap.get(row.id) ?? [],
      ),
    };
  }

  async create(familyId: number, viewerId: number, input: unknown): Promise<PersonReadResponse> {
    const data = validateUpsertInput(input);
    await this.assertRelatedPersonsInFamily(familyId, data);

    const personId = await personsRepository.createPerson(familyId, data);
    const readFocus = await this.defaultReadFocus(viewerId);
    return this.getById(familyId, viewerId, personId, readFocus);
  }

  async update(
    familyId: number,
    viewerId: number,
    personId: number,
    input: unknown,
  ): Promise<PersonReadResponse> {
    const existing = await personsRepository.findById(familyId, personId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    const data = validateUpsertInput(input);
    await this.assertRelatedPersonsInFamily(familyId, data);

    await personsRepository.updatePerson(familyId, personId, data);
    const readFocus = await this.defaultReadFocus(viewerId);
    return this.getById(familyId, viewerId, personId, readFocus);
  }

  async remove(familyId: number, viewerId: number, personId: number): Promise<void> {
    const existing = await personsRepository.findById(familyId, personId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    const rootPersonId = await personsRepository.getRootPersonId(familyId);
    if (personId === viewerId && personId === rootPersonId) {
      throw new AppError(
        403,
        ErrorCodes.PERSON_DELETE_FORBIDDEN,
        'Tidak dapat menghapus akun root keluarga.',
      );
    }

    await personsRepository.softDelete(familyId, personId);
  }

  async map(
    familyId: number,
    viewerId: number,
    readFocus: ReadFocusMeta,
    queryInput: Record<string, unknown> = {},
  ): Promise<PersonMapResponse> {
    const query = parseMapQuery(queryInput);
    const filter = {
      ...PERSPECTIVE_VIEW_DEFAULTS,
      ...(query.lineage ? { lineage: query.lineage } : {}),
    };

    const [visibleIds, { graph, spouseMap }] = await Promise.all([
      getVisiblePersonIds(familyId, readFocus.focusPersonId, viewerId, filter),
      this.loadGraphContext(familyId),
    ]);

    const allRows = await personsRepository.findAllByFamily(familyId);
    const labelPerspectiveId = readFocus.focusPersonId;

    const visiblePersons = allRows
      .filter((row) => visibleIds.has(row.id))
      .map((row) => {
        const mapped = mapPersonRowToResponse(
          row,
          viewerId,
          labelPerspectiveId,
          graph,
          spouseMap.get(row.id) ?? [],
        );
        return {
          id: mapped.id,
          fullName: mapped.fullName,
          nickname: mapped.nickname,
          gender: mapped.gender,
          status: mapped.status,
          photoUrl: mapped.photoUrl,
          generationLabel: mapped.generationLabel,
          phone: mapped.phone,
          phoneAlt: mapped.phoneAlt,
          address: mapped.address,
        };
      })
      .filter((person) => matchesMapFilters(person, query));

    let withAddress = 0;
    let withExactCoords = 0;
    let withCityOnly = 0;

    for (const person of visiblePersons) {
      if (hasAnyAddress(person.address)) {
        withAddress += 1;
      }
      if (hasExactCoords(person.address)) {
        withExactCoords += 1;
      } else if (hasCityLevel(person.address)) {
        withCityOnly += 1;
      }
    }

    return {
      ...readFocus,
      selfPersonId: viewerId,
      persons: visiblePersons,
      meta: {
        totalVisible: visiblePersons.length,
        withAddress,
        withExactCoords,
        withCityOnly,
      },
    };
  }

  async patchAddress(
    familyId: number,
    viewerId: number,
    personId: number,
    readFocus: ReadFocusMeta,
    input: unknown,
  ): Promise<PersonReadResponse> {
    const viewer = await authRepository.findPersonById(viewerId);
    if (!viewer) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    const birthDate = formatBirthDate(viewer.birth_date);
    if (!isLegalAge(birthDate)) {
      throw new AppError(
        403,
        ErrorCodes.PERSON_UPDATE_FORBIDDEN,
        'Hanya anggota dewasa (18+) yang boleh mengubah data alamat.',
      );
    }

    const existing = await personsRepository.findById(familyId, personId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.PERSON_NOT_FOUND, 'Person tidak ditemukan.');
    }

    const address = validatePatchAddressInput(input);
    await personsRepository.patchAddress(personId, address);
    return this.getById(familyId, viewerId, personId, readFocus);
  }

  private async assertRelatedPersonsInFamily(
    familyId: number,
    input: UpsertPersonInput,
  ): Promise<void> {
    const relatedIds = [
      input.fatherId,
      input.motherId,
      ...(input.spouseIds ?? []),
    ].filter((id): id is number => typeof id === 'number');

    for (const relatedId of relatedIds) {
      const related = await personsRepository.findById(familyId, relatedId);
      if (!related) {
        throw new AppError(
          400,
          ErrorCodes.PERSON_VALIDATION_FAILED,
          'Relasi person tidak valid atau di luar keluarga.',
        );
      }
    }
  }
}

export const personsService = new PersonsService();
