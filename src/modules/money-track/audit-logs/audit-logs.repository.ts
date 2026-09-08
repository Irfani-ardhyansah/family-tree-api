import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyAuditLogRow } from '../money.types';

export type AuditListFilters = {
  q?: string;
  actorPersonId?: number;
  entityType?: string;
  entityId?: number;
  action?: 'create' | 'update' | 'delete';
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export class AuditLogsRepository {
  private base(workspaceId: number, filters: AuditListFilters) {
    let q = db(Tables.MONEY_AUDIT_LOGS)
      .leftJoin(
        Tables.MONEY_PERSONS,
        `${Tables.MONEY_PERSONS}.id`,
        `${Tables.MONEY_AUDIT_LOGS}.actor_person_id`,
      )
      .where(`${Tables.MONEY_AUDIT_LOGS}.workspace_id`, workspaceId);

    if (filters.actorPersonId != null) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.actor_person_id`, filters.actorPersonId);
    }
    if (filters.entityType) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.entity_type`, filters.entityType);
    }
    if (filters.entityId != null) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.entity_id`, filters.entityId);
    }
    if (filters.action) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.action`, filters.action);
    }
    if (filters.from) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.created_at`, '>=', `${filters.from} 00:00:00`);
    }
    if (filters.to) {
      q = q.where(`${Tables.MONEY_AUDIT_LOGS}.created_at`, '<=', `${filters.to} 23:59:59`);
    }
    if (filters.q) {
      const like = `%${filters.q}%`;
      q = q.andWhere((builder) => {
        void builder
          .whereILike(`${Tables.MONEY_AUDIT_LOGS}.summary`, like)
          .orWhereILike(`${Tables.MONEY_PERSONS}.name`, like)
          .orWhereRaw(`CAST(${Tables.MONEY_AUDIT_LOGS}.entity_id AS CHAR) LIKE ?`, [like]);
      });
    }
    return q;
  }

  async count(workspaceId: number, filters: AuditListFilters): Promise<number> {
    const row = await this.base(workspaceId, filters)
      .countDistinct<{ total: number | string }>({
        total: `${Tables.MONEY_AUDIT_LOGS}.id`,
      })
      .first();
    return Number(row?.total ?? 0);
  }

  async list(
    workspaceId: number,
    filters: AuditListFilters,
  ): Promise<MoneyAuditLogRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    return this.base(workspaceId, filters)
      .orderBy(`${Tables.MONEY_AUDIT_LOGS}.created_at`, 'desc')
      .orderBy(`${Tables.MONEY_AUDIT_LOGS}.id`, 'desc')
      .limit(filters.pageSize)
      .offset(offset)
      .select<MoneyAuditLogRow[]>(`${Tables.MONEY_AUDIT_LOGS}.*`);
  }

  async findById(
    workspaceId: number,
    id: number,
  ): Promise<MoneyAuditLogRow | undefined> {
    return db(Tables.MONEY_AUDIT_LOGS)
      .where({ id, workspace_id: workspaceId })
      .first<MoneyAuditLogRow>('*');
  }
}

export const auditLogsRepository = new AuditLogsRepository();
