import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { ActiveSessionRow } from './admin.types';

export class AdminSessionsRepository {
  async listActive(familyId: number, userId?: number): Promise<ActiveSessionRow[]> {
    const query = db(`${Tables.REFRESH_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .whereNull('t.revoked_at')
      .where('t.expires_at', '>', db.fn.now())
      .whereNull('p.deleted_at')
      .andWhere(function familyScope() {
        this.where('t.family_id', familyId).orWhere(function legacy() {
          this.whereNull('t.family_id').andWhere('p.family_id', familyId);
        });
      })
      .select<ActiveSessionRow[]>([
        't.id',
        't.person_id',
        't.family_id',
        't.device',
        't.browser',
        't.ip_address',
        't.created_at',
        't.last_active_at',
        'p.full_name as person_name',
      ])
      .orderBy('t.last_active_at', 'desc')
      .orderBy('t.id', 'desc');

    if (userId != null) {
      query.andWhere('t.person_id', userId);
    }

    return query;
  }

  async findActiveById(familyId: number, sessionId: number): Promise<ActiveSessionRow | undefined> {
    return db(`${Tables.REFRESH_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .where('t.id', sessionId)
      .whereNull('t.revoked_at')
      .where('t.expires_at', '>', db.fn.now())
      .whereNull('p.deleted_at')
      .andWhere(function familyScope() {
        this.where('t.family_id', familyId).orWhere(function legacy() {
          this.whereNull('t.family_id').andWhere('p.family_id', familyId);
        });
      })
      .first<ActiveSessionRow>([
        't.id',
        't.person_id',
        't.family_id',
        't.device',
        't.browser',
        't.ip_address',
        't.created_at',
        't.last_active_at',
        'p.full_name as person_name',
      ]);
  }

  async revokeById(sessionId: number): Promise<number> {
    return db(Tables.REFRESH_TOKENS).where({ id: sessionId }).whereNull('revoked_at').update({
      revoked_at: db.fn.now(),
    });
  }

  async countActive(familyId: number): Promise<number> {
    const [row] = await db(`${Tables.REFRESH_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .whereNull('t.revoked_at')
      .where('t.expires_at', '>', db.fn.now())
      .whereNull('p.deleted_at')
      .andWhere(function familyScope() {
        this.where('t.family_id', familyId).orWhere(function legacy() {
          this.whereNull('t.family_id').andWhere('p.family_id', familyId);
        });
      })
      .count<{ total: number | string }[]>({ total: '*' });
    return Number(row?.total ?? 0);
  }
}

export const adminSessionsRepository = new AdminSessionsRepository();
