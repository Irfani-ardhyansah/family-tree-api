import type { Knex } from 'knex';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AdminAuditLogQuery, AdminAuditLogRow, RecordAdminAuditInput } from './admin.types';

export class AdminAuditRepository {
  async insert(input: RecordAdminAuditInput): Promise<number> {
    const [id] = await db(Tables.ADMIN_AUDIT_LOGS).insert({
      family_id: input.familyId,
      actor_person_id: input.actorPersonId,
      module_id: input.moduleId,
      action: input.action,
      summary: input.summary,
      before: input.before ? JSON.stringify(input.before) : null,
      after: input.after ? JSON.stringify(input.after) : null,
      occurred_at: db.fn.now(),
    });
    return Number(id);
  }

  private applyFilters(query: Knex.QueryBuilder, filters: AdminAuditLogQuery): void {
    if (filters.userId != null) {
      query.andWhere('a.actor_person_id', filters.userId);
    }
    if (filters.moduleId) {
      query.andWhere('a.module_id', filters.moduleId);
    }
    if (filters.action) {
      query.andWhere('a.action', filters.action);
    }
    if (filters.from) {
      query.andWhere('a.occurred_at', '>=', `${filters.from} 00:00:00`);
    }
    if (filters.to) {
      query.andWhere('a.occurred_at', '<=', `${filters.to} 23:59:59`);
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      query.andWhere(function search() {
        this.where('a.summary', 'like', q).orWhere('p.full_name', 'like', q);
      });
    }
  }

  async countByFilters(familyId: number, filters: AdminAuditLogQuery): Promise<number> {
    const query = db(`${Tables.ADMIN_AUDIT_LOGS} as a`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'a.actor_person_id')
      .where('a.family_id', familyId)
      .count({ total: '*' });

    this.applyFilters(query, filters);
    const [row] = await query;
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }

  async findByFilters(familyId: number, filters: AdminAuditLogQuery): Promise<AdminAuditLogRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    const query = db(`${Tables.ADMIN_AUDIT_LOGS} as a`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'a.actor_person_id')
      .where('a.family_id', familyId)
      .select<AdminAuditLogRow[]>([
        'a.id',
        'a.family_id',
        'a.actor_person_id',
        'p.full_name as actor_name',
        'a.module_id',
        'a.action',
        'a.summary',
        'a.before',
        'a.after',
        'a.occurred_at',
      ]);

    this.applyFilters(query, filters);
    return query
      .orderBy('a.occurred_at', 'desc')
      .orderBy('a.id', 'desc')
      .limit(filters.pageSize)
      .offset(offset);
  }

  async findById(familyId: number, id: number): Promise<AdminAuditLogRow | undefined> {
    return db(`${Tables.ADMIN_AUDIT_LOGS} as a`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'a.actor_person_id')
      .where('a.family_id', familyId)
      .andWhere('a.id', id)
      .first<AdminAuditLogRow>([
        'a.id',
        'a.family_id',
        'a.actor_person_id',
        'p.full_name as actor_name',
        'a.module_id',
        'a.action',
        'a.summary',
        'a.before',
        'a.after',
        'a.occurred_at',
      ]);
  }
}

export const adminAuditRepository = new AdminAuditRepository();
