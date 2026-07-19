import db from '../../config/database';
import { formatBirthDate } from '../auth/auth.mapper';
import {
  PersonAddress,
  PersonGraphNode,
  PersonResponse,
  PersonRow,
  SpousePairRow,
  UpsertPersonInput,
} from './persons.types';
import { generationLabelService } from './generation-label.service';

const PERSON_SELECT = [
  'p.id',
  'p.family_id',
  'p.full_name',
  'p.nickname',
  'p.gender',
  'p.birth_date',
  'p.death_date',
  'p.status',
  'p.father_id',
  'p.mother_id',
  'p.deleted_at',
  'd.religion',
  'd.photo_url',
  'd.occupation',
  'd.phone',
  'd.phone_alt',
  'a.street',
  'a.district',
  'a.city',
  'a.province',
  'a.postal_code',
  'a.country',
  'a.latitude',
  'a.longitude',
  'fm.role',
];

function mapAddress(row: PersonRow): PersonAddress | null {
  if (!row.street && !row.city && !row.district && !row.province) {
    return null;
  }

  return {
    street: row.street,
    district: row.district,
    city: row.city,
    province: row.province,
    postalCode: row.postal_code,
    country: row.country,
    latitude: row.latitude !== null ? Number(row.latitude) : null,
    longitude: row.longitude !== null ? Number(row.longitude) : null,
  };
}

function toGraphNodes(rows: PersonRow[], spouseMap: Map<number, number[]>): PersonGraphNode[] {
  return rows.map((row) => ({
    id: row.id,
    gender: row.gender,
    fatherId: row.father_id,
    motherId: row.mother_id,
    spouseIds: spouseMap.get(row.id) ?? [],
  }));
}

export function mapPersonRowToResponse(
  row: PersonRow,
  viewerId: number,
  graph: PersonGraphNode[],
  spouseIds: number[],
): PersonResponse {
  return {
    id: row.id,
    fullName: row.full_name,
    nickname: row.nickname,
    gender: row.gender,
    birthDate: formatBirthDate(row.birth_date),
    deathDate: row.death_date ? formatBirthDate(row.death_date) : null,
    status: row.status,
    religion: row.religion,
    photoUrl: row.photo_url,
    occupation: row.occupation,
    phone: row.phone,
    phoneAlt: row.phone_alt,
    address: mapAddress(row),
    fatherId: row.father_id,
    motherId: row.mother_id,
    spouseIds,
    generationLabel: generationLabelService.build(viewerId, row.id, graph),
    isSelf: row.id === viewerId,
    role: row.role ?? 'member',
  };
}

export class PersonsRepository {
  private baseQuery(familyId: number) {
    return db('persons as p')
      .leftJoin('person_details as d', 'd.person_id', 'p.id')
      .leftJoin('person_addresses as a', 'a.person_id', 'p.id')
      .leftJoin('family_members as fm', function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', db.raw('?', [familyId]));
      })
      .where('p.family_id', familyId)
      .whereNull('p.deleted_at');
  }

  async getRootPersonId(familyId: number): Promise<number | null> {
    const family = await db('families').where({ id: familyId }).first<{ root_person_id: number | null }>(
      'root_person_id',
    );
    return family?.root_person_id ?? null;
  }

  async findAllByFamily(familyId: number): Promise<PersonRow[]> {
    return this.baseQuery(familyId).select<PersonRow[]>(PERSON_SELECT).orderBy('p.id', 'asc');
  }

  async countByFamily(familyId: number): Promise<number> {
    const result = await this.baseQuery(familyId).count<{ count: number }[]>({ count: '*' });
    return Number(result[0]?.count ?? 0);
  }

  async findByFamilyPaginated(
    familyId: number,
    page: number,
    limit: number,
  ): Promise<PersonRow[]> {
    const offset = (page - 1) * limit;
    return this.baseQuery(familyId)
      .select<PersonRow[]>(PERSON_SELECT)
      .orderBy('p.id', 'asc')
      .limit(limit)
      .offset(offset);
  }

  async findGraphNodes(familyId: number): Promise<PersonGraphNode[]> {
    const rows = await db('persons as p')
      .where('p.family_id', familyId)
      .whereNull('p.deleted_at')
      .select<Pick<PersonRow, 'id' | 'gender' | 'father_id' | 'mother_id'>[]>(
        'p.id',
        'p.gender',
        'p.father_id',
        'p.mother_id',
      );

    const pairs = await this.findSpousePairs(familyId);
    const spouseMap = this.buildSpouseMap(pairs);

    return rows.map((row) => ({
      id: row.id,
      gender: row.gender,
      fatherId: row.father_id,
      motherId: row.mother_id,
      spouseIds: spouseMap.get(row.id) ?? [],
    }));
  }

  async findById(familyId: number, personId: number): Promise<PersonRow | undefined> {
    return this.baseQuery(familyId).where('p.id', personId).first<PersonRow>(PERSON_SELECT);
  }

  async findSpousePairs(familyId: number): Promise<SpousePairRow[]> {
    return db('person_spouses as ps')
      .innerJoin('persons as pa', 'pa.id', 'ps.person_id_a')
      .innerJoin('persons as pb', 'pb.id', 'ps.person_id_b')
      .where('pa.family_id', familyId)
      .whereNull('pa.deleted_at')
      .whereNull('pb.deleted_at')
      .select<SpousePairRow[]>('ps.person_id_a', 'ps.person_id_b');
  }

  buildSpouseMap(pairs: SpousePairRow[]): Map<number, number[]> {
    const map = new Map<number, number[]>();

    for (const pair of pairs) {
      const listA = map.get(pair.person_id_a) ?? [];
      listA.push(pair.person_id_b);
      map.set(pair.person_id_a, listA);

      const listB = map.get(pair.person_id_b) ?? [];
      listB.push(pair.person_id_a);
      map.set(pair.person_id_b, listB);
    }

    return map;
  }

  async createPerson(familyId: number, input: UpsertPersonInput): Promise<number> {
    return db.transaction(async (trx) => {
      const status = input.status ?? 'alive';
      let religion = input.religion ?? null;
      if (status === 'deceased' && !religion) {
        religion = 'islam';
      }

      const [personId] = await trx('persons').insert({
        family_id: familyId,
        full_name: input.fullName,
        nickname: input.nickname ?? null,
        gender: input.gender,
        birth_date: input.birthDate,
        death_date: input.deathDate ?? null,
        status,
        father_id: input.fatherId ?? null,
        mother_id: input.motherId ?? null,
      });

      const id = Number(personId);
      await this.upsertDetails(trx, id, { ...input, religion, status });
      await this.upsertAddress(trx, id, input.address ?? null);
      await trx('family_members').insert({
        family_id: familyId,
        person_id: id,
        role: input.role ?? 'member',
      });

      if (input.spouseIds?.length) {
        await this.syncSpouses(trx, familyId, id, input.spouseIds);
      }

      return id;
    });
  }

  async updatePerson(familyId: number, personId: number, input: UpsertPersonInput): Promise<void> {
    await db.transaction(async (trx) => {
      const status = input.status ?? 'alive';
      let religion = input.religion ?? null;
      if (status === 'deceased' && !religion) {
        religion = 'islam';
      }

      await trx('persons')
        .where({ id: personId, family_id: familyId })
        .whereNull('deleted_at')
        .update({
          full_name: input.fullName,
          nickname: input.nickname ?? null,
          gender: input.gender,
          birth_date: input.birthDate,
          death_date: input.deathDate ?? null,
          status,
          father_id: input.fatherId ?? null,
          mother_id: input.motherId ?? null,
          updated_at: trx.fn.now(),
        });

      await this.upsertDetails(trx, personId, { ...input, religion, status });
      await this.upsertAddress(trx, personId, input.address ?? null);

      if (input.role) {
        await trx('family_members').where({ family_id: familyId, person_id: personId }).update({
          role: input.role,
          updated_at: trx.fn.now(),
        });
      }

      if (input.spouseIds !== undefined) {
        await this.syncSpouses(trx, familyId, personId, input.spouseIds);
      }
    });
  }

  async softDelete(familyId: number, personId: number): Promise<void> {
    await db('persons')
      .where({ id: personId, family_id: familyId })
      .whereNull('deleted_at')
      .update({ deleted_at: db.fn.now() });
  }

  async countActivePersons(familyId: number): Promise<number> {
    const result = await db('persons')
      .where({ family_id: familyId })
      .whereNull('deleted_at')
      .count<{ count: number }[]>({ count: '*' });
    return Number(result[0]?.count ?? 0);
  }

  private async upsertDetails(
    trx: typeof db,
    personId: number,
    input: UpsertPersonInput & { religion: 'islam' | 'other' | null; status: 'alive' | 'deceased' },
  ): Promise<void> {
    const hasDetails = Boolean(
      input.religion || input.photoUrl || input.occupation || input.phone || input.phoneAlt,
    );

    if (!hasDetails) {
      await trx('person_details').where({ person_id: personId }).del();
      return;
    }

    const existing = await trx('person_details').where({ person_id: personId }).first();
    const payload = {
      religion: input.religion,
      photo_url: input.photoUrl ?? null,
      occupation: input.occupation ?? null,
      phone: input.phone ?? null,
      phone_alt: input.phoneAlt ?? null,
      updated_at: trx.fn.now(),
    };

    if (existing) {
      await trx('person_details').where({ person_id: personId }).update(payload);
    } else {
      await trx('person_details').insert({ person_id: personId, ...payload });
    }
  }

  private async upsertAddress(
    trx: typeof db,
    personId: number,
    address: PersonAddress | null,
  ): Promise<void> {
    const hasAddress = Boolean(
      address &&
        (address.street ||
          address.district ||
          address.city ||
          address.province ||
          address.postalCode ||
          address.country ||
          address.latitude ||
          address.longitude),
    );

    if (!hasAddress) {
      await trx('person_addresses').where({ person_id: personId }).del();
      return;
    }

    const payload = {
      street: address?.street ?? null,
      district: address?.district ?? null,
      city: address?.city ?? null,
      province: address?.province ?? null,
      postal_code: address?.postalCode ?? null,
      country: address?.country ?? null,
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
      updated_at: trx.fn.now(),
    };

    const existing = await trx('person_addresses').where({ person_id: personId }).first();
    if (existing) {
      await trx('person_addresses').where({ person_id: personId }).update(payload);
    } else {
      await trx('person_addresses').insert({ person_id: personId, ...payload });
    }
  }

  private async syncSpouses(
    trx: typeof db,
    familyId: number,
    personId: number,
    spouseIds: number[],
  ): Promise<void> {
    await trx('person_spouses')
      .where('person_id_a', personId)
      .orWhere('person_id_b', personId)
      .del();

    const unique = [...new Set(spouseIds.filter((id) => id !== personId))];
    for (const spouseId of unique) {
      const spouse = await trx('persons')
        .where({ id: spouseId, family_id: familyId })
        .whereNull('deleted_at')
        .first();
      if (!spouse) continue;

      const personIdA = Math.min(personId, spouseId);
      const personIdB = Math.max(personId, spouseId);
      await trx('person_spouses')
        .insert({ person_id_a: personIdA, person_id_b: personIdB })
        .onConflict(['person_id_a', 'person_id_b'])
        .ignore();
    }
  }
}

export const personsRepository = new PersonsRepository();

export { toGraphNodes };
