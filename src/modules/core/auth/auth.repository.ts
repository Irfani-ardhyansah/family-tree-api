import db from '../../../config/database';
import { PersonAuthRow, RefreshTokenRow } from './auth.types';
import { Tables } from '../../../shared/database/tables';

export class AuthRepository {
  private authPersonSelect() {
    return [
      'p.id',
      'p.family_id',
      'p.full_name',
      'p.nickname',
      'p.gender',
      'p.birth_date',
      'p.status',
      'd.photo_url',
      db.raw("COALESCE(fm.role, 'member') as role"),
    ];
  }

  async findAlivePersons(): Promise<PersonAuthRow[]> {
    return db(`${Tables.PERSONS} as p`)
      .leftJoin(`${Tables.PERSON_DETAILS} as d`, 'd.person_id', 'p.id')
      .leftJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .select<PersonAuthRow[]>(this.authPersonSelect());
  }

  async findPersonById(personId: number): Promise<PersonAuthRow | undefined> {
    return db(`${Tables.PERSONS} as p`)
      .leftJoin(`${Tables.PERSON_DETAILS} as d`, 'd.person_id', 'p.id')
      .leftJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.id', personId)
      .whereNull('p.deleted_at')
      .first<PersonAuthRow>(this.authPersonSelect());
  }

  async findSpouseIdsByPersonId(personId: number): Promise<number[]> {
    const rows = await db(`${Tables.PERSON_SPOUSES} as ps`)
      .innerJoin(`${Tables.PERSONS} as pa`, 'pa.id', 'ps.person_id_a')
      .innerJoin(`${Tables.PERSONS} as pb`, 'pb.id', 'ps.person_id_b')
      .where(function whereSpouse() {
        this.where('ps.person_id_a', personId).orWhere('ps.person_id_b', personId);
      })
      .whereNull('pa.deleted_at')
      .whereNull('pb.deleted_at')
      .select<{ person_id_a: number; person_id_b: number }[]>('ps.person_id_a', 'ps.person_id_b');

    return rows.map((row) => (row.person_id_a === personId ? row.person_id_b : row.person_id_a));
  }

  async findPersonsByIds(personIds: number[]): Promise<PersonAuthRow[]> {
    if (personIds.length === 0) {
      return [];
    }

    return db(`${Tables.PERSONS} as p`)
      .leftJoin(`${Tables.PERSON_DETAILS} as d`, 'd.person_id', 'p.id')
      .leftJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .whereIn('p.id', personIds)
      .whereNull('p.deleted_at')
      .select<PersonAuthRow[]>(this.authPersonSelect());
  }

  async insertRefreshToken(input: {
    personId: number;
    familyId: number;
    tokenHash: string;
    expiresAt: Date;
    device?: string | null;
    browser?: string | null;
    ipAddress?: string | null;
  }): Promise<number> {
    const [id] = await db(Tables.REFRESH_TOKENS).insert({
      person_id: input.personId,
      family_id: input.familyId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
      device: input.device ?? null,
      browser: input.browser ?? null,
      ip_address: input.ipAddress ?? null,
      last_active_at: db.fn.now(),
    });
    return Number(id);
  }

  async findActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return db(Tables.REFRESH_TOKENS)
      .where({ token_hash: tokenHash })
      .whereNull('revoked_at')
      .where('expires_at', '>', db.fn.now())
      .first<RefreshTokenRow>();
  }

  async revokeRefreshToken(tokenHash: string): Promise<number> {
    return db(Tables.REFRESH_TOKENS).where({ token_hash: tokenHash }).whereNull('revoked_at').update({
      revoked_at: db.fn.now(),
    });
  }
}

export const authRepository = new AuthRepository();
