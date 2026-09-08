import type { Knex } from 'knex';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import {
  AdminAuditLogQuery,
  AdminAuditLogRow,
  AdminAuditSource,
  RecordAdminAuditInput,
} from './admin.types';

type UnifiedRow = AdminAuditLogRow & {
  source: AdminAuditSource;
  entity_type: string | null;
  entity_id: number | string | null;
};

function includeAdminBranch(filters: AdminAuditLogQuery): boolean {
  return !filters.moduleId || filters.moduleId !== 'money';
}

function includeMoneyBranch(filters: AdminAuditLogQuery): boolean {
  return !filters.moduleId || filters.moduleId === 'money';
}

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

  private applyAdminFilters(query: Knex.QueryBuilder, filters: AdminAuditLogQuery): void {
    if (filters.userId != null) {
      query.andWhere('a.actor_person_id', filters.userId);
    }
    if (filters.moduleId && filters.moduleId !== 'money') {
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

  private applyMoneyFilters(query: Knex.QueryBuilder, filters: AdminAuditLogQuery): void {
    if (filters.userId != null) {
      // Admin `userId` = core person id → mt_persons.user_id
      query.andWhere('mp.user_id', filters.userId);
    }
    if (filters.action) {
      query.andWhere('m.action', filters.action);
    }
    if (filters.from) {
      query.andWhere('m.created_at', '>=', `${filters.from} 00:00:00`);
    }
    if (filters.to) {
      query.andWhere('m.created_at', '<=', `${filters.to} 23:59:59`);
    }
    if (filters.q?.trim()) {
      const q = `%${filters.q.trim()}%`;
      query.andWhere(function search() {
        this.where('m.summary', 'like', q)
          .orWhere('mp.name', 'like', q)
          .orWhere('cp.full_name', 'like', q)
          .orWhereRaw('CAST(m.entity_id AS CHAR) LIKE ?', [q]);
      });
    }
  }

  private adminSelect(familyId: number, filters: AdminAuditLogQuery): Knex.QueryBuilder {
    const query = db(`${Tables.ADMIN_AUDIT_LOGS} as a`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'a.actor_person_id')
      .where('a.family_id', familyId)
      .select([
        'a.id as id',
        db.raw(`'admin' as source`),
        'a.family_id as family_id',
        'a.actor_person_id as actor_person_id',
        'p.full_name as actor_name',
        'a.module_id as module_id',
        'a.action as action',
        'a.summary as summary',
        'a.before as before',
        'a.after as after',
        'a.occurred_at as occurred_at',
        db.raw('NULL as entity_type'),
        db.raw('NULL as entity_id'),
      ]);
    this.applyAdminFilters(query, filters);
    return query;
  }

  private moneySelect(familyId: number, filters: AdminAuditLogQuery): Knex.QueryBuilder {
    const query = db(`${Tables.MONEY_AUDIT_LOGS} as m`)
      .innerJoin(`${Tables.MONEY_WORKSPACES} as w`, function joinWs() {
        this.on('w.id', '=', 'm.workspace_id').andOnVal('w.family_id', familyId);
      })
      .leftJoin(`${Tables.MONEY_PERSONS} as mp`, 'mp.id', 'm.actor_person_id')
      .leftJoin(`${Tables.PERSONS} as cp`, 'cp.id', 'mp.user_id')
      .select([
        'm.id as id',
        db.raw(`'money' as source`),
        'w.family_id as family_id',
        'mp.user_id as actor_person_id',
        db.raw('COALESCE(cp.full_name, mp.name) as actor_name'),
        db.raw(`'money' as module_id`),
        'm.action as action',
        'm.summary as summary',
        'm.before as before',
        'm.after as after',
        'm.created_at as occurred_at',
        'm.entity_type as entity_type',
        'm.entity_id as entity_id',
      ]);
    this.applyMoneyFilters(query, filters);
    return query;
  }

  private unifiedSubquery(familyId: number, filters: AdminAuditLogQuery): Knex.QueryBuilder {
    const wantAdmin = includeAdminBranch(filters);
    const wantMoney = includeMoneyBranch(filters);

    if (wantAdmin && wantMoney) {
      return this.adminSelect(familyId, filters).unionAll([this.moneySelect(familyId, filters)]);
    }
    if (wantMoney) {
      return this.moneySelect(familyId, filters);
    }
    return this.adminSelect(familyId, filters);
  }

  async countByFilters(familyId: number, filters: AdminAuditLogQuery): Promise<number> {
    const union = this.unifiedSubquery(familyId, filters).as('u');
    const [row] = await db.from(union).count({ total: '*' });
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }

  async findByFilters(familyId: number, filters: AdminAuditLogQuery): Promise<UnifiedRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    const union = this.unifiedSubquery(familyId, filters).as('u');
    return db
      .from(union)
      .orderBy('occurred_at', 'desc')
      .orderBy('source', 'asc')
      .orderBy('id', 'desc')
      .limit(filters.pageSize)
      .offset(offset)
      .select<UnifiedRow[]>('*');
  }

  async findById(familyId: number, id: number): Promise<UnifiedRow | undefined> {
    const row = await db(`${Tables.ADMIN_AUDIT_LOGS} as a`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'a.actor_person_id')
      .where('a.family_id', familyId)
      .andWhere('a.id', id)
      .first([
        'a.id',
        db.raw(`'admin' as source`),
        'a.family_id',
        'a.actor_person_id',
        'p.full_name as actor_name',
        'a.module_id',
        'a.action',
        'a.summary',
        'a.before',
        'a.after',
        'a.occurred_at',
        db.raw('NULL as entity_type'),
        db.raw('NULL as entity_id'),
      ]);
    return row as UnifiedRow | undefined;
  }

  async findMoneyById(familyId: number, id: number): Promise<UnifiedRow | undefined> {
    const row = await db(`${Tables.MONEY_AUDIT_LOGS} as m`)
      .innerJoin(`${Tables.MONEY_WORKSPACES} as w`, function joinWs() {
        this.on('w.id', '=', 'm.workspace_id').andOnVal('w.family_id', familyId);
      })
      .leftJoin(`${Tables.MONEY_PERSONS} as mp`, 'mp.id', 'm.actor_person_id')
      .leftJoin(`${Tables.PERSONS} as cp`, 'cp.id', 'mp.user_id')
      .where('m.id', id)
      .first([
        'm.id',
        db.raw(`'money' as source`),
        'w.family_id',
        'mp.user_id as actor_person_id',
        db.raw('COALESCE(cp.full_name, mp.name) as actor_name'),
        db.raw(`'money' as module_id`),
        'm.action',
        'm.summary',
        'm.before',
        'm.after',
        'm.created_at as occurred_at',
        'm.entity_type as entity_type',
        'm.entity_id as entity_id',
      ]);
    return row as UnifiedRow | undefined;
  }
}

export const adminAuditRepository = new AdminAuditRepository();
