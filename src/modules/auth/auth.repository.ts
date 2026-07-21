import db from '../../config/database';
import { PersonAuthRow, RefreshTokenRow } from './auth.types';

export class AuthRepository {
  async findAlivePersons(): Promise<PersonAuthRow[]> {
    return db('persons as p')
      .leftJoin('person_details as d', 'd.person_id', 'p.id')
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .select<PersonAuthRow[]>([
        'p.id',
        'p.family_id',
        'p.full_name',
        'p.nickname',
        'p.gender',
        'p.birth_date',
        'p.status',
        'd.photo_url',
      ]);
  }

  async findPersonById(personId: number): Promise<PersonAuthRow | undefined> {
    return db('persons as p')
      .leftJoin('person_details as d', 'd.person_id', 'p.id')
      .where('p.id', personId)
      .whereNull('p.deleted_at')
      .first<PersonAuthRow>([
        'p.id',
        'p.family_id',
        'p.full_name',
        'p.nickname',
        'p.gender',
        'p.birth_date',
        'p.status',
        'd.photo_url',
      ]);
  }

  async findSpouseIdsByPersonId(personId: number): Promise<number[]> {
    const rows = await db('person_spouses as ps')
      .innerJoin('persons as pa', 'pa.id', 'ps.person_id_a')
      .innerJoin('persons as pb', 'pb.id', 'ps.person_id_b')
      .where(function whereSpouse() {
        this.where('ps.person_id_a', personId).orWhere('ps.person_id_b', personId);
      })
      .whereNull('pa.deleted_at')
      .whereNull('pb.deleted_at')
      .select<{ person_id_a: number; person_id_b: number }[]>('ps.person_id_a', 'ps.person_id_b');

    return rows.map((row) => (row.person_id_a === personId ? row.person_id_b : row.person_id_a));
  }

  async insertRefreshToken(input: {
    personId: number;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await db('refresh_tokens').insert({
      person_id: input.personId,
      token_hash: input.tokenHash,
      expires_at: input.expiresAt,
    });
  }

  async findActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRow | undefined> {
    return db('refresh_tokens')
      .where({ token_hash: tokenHash })
      .whereNull('revoked_at')
      .where('expires_at', '>', db.fn.now())
      .first<RefreshTokenRow>();
  }

  async revokeRefreshToken(tokenHash: string): Promise<number> {
    return db('refresh_tokens').where({ token_hash: tokenHash }).whereNull('revoked_at').update({
      revoked_at: db.fn.now(),
    });
  }
}

export const authRepository = new AuthRepository();
