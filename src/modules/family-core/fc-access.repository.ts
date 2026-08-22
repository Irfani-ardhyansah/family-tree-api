import db from '../../config/database';
import { Tables } from '../../shared/database/tables';

export class FcAccessRepository {
  async findMembership(
    familyId: number,
    personId: number,
  ): Promise<{ family_id: number; person_id: number; role: string } | undefined> {
    return db(Tables.FAMILY_MEMBERS)
      .where({ family_id: familyId, person_id: personId })
      .first('family_id', 'person_id', 'role');
  }

  async listCoreMembers(familyId: number): Promise<
    Array<{
      person_id: number;
      full_name: string;
      nickname: string | null;
      gender: string | null;
      photo_url: string | null;
    }>
  > {
    return db(`${Tables.FAMILY_MEMBERS} as fm`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 'fm.person_id')
      .leftJoin(`${Tables.PERSON_DETAILS} as d`, 'd.person_id', 'p.id')
      .where('fm.family_id', familyId)
      .whereNull('p.deleted_at')
      .select(
        'p.id as person_id',
        'p.full_name',
        'p.nickname',
        'p.gender',
        'd.photo_url',
      )
      .orderBy('p.full_name', 'asc');
  }

  async findSpouseIds(personId: number): Promise<number[]> {
    const rows = await db(Tables.PERSON_SPOUSES)
      .where(function whereSpouse() {
        this.where('person_id_a', personId).orWhere('person_id_b', personId);
      })
      .select<{ person_id_a: number; person_id_b: number }[]>('person_id_a', 'person_id_b');

    return rows.map((row) => (row.person_id_a === personId ? row.person_id_b : row.person_id_a));
  }

  async findParents(personId: number): Promise<{
    father_id: number | null;
    mother_id: number | null;
  } | null> {
    const row = await db(Tables.PERSON_LINEAGE)
      .where({ person_id: personId })
      .first<{ father_id: number | null; mother_id: number | null }>(
        'father_id',
        'mother_id',
      );
    return row ?? null;
  }

  async findPersonsByIds(
    familyId: number,
    personIds: number[],
  ): Promise<
    Array<{
      id: number;
      full_name: string;
      nickname: string | null;
      gender: string | null;
      photo_url: string | null;
    }>
  > {
    if (personIds.length === 0) return [];
    return db(`${Tables.PERSONS} as p`)
      .leftJoin(`${Tables.PERSON_DETAILS} as d`, 'd.person_id', 'p.id')
      .where('p.family_id', familyId)
      .whereIn('p.id', personIds)
      .whereNull('p.deleted_at')
      .select('p.id', 'p.full_name', 'p.nickname', 'p.gender', 'd.photo_url');
  }
}

export const fcAccessRepository = new FcAccessRepository();
