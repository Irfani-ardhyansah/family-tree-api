import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyAuditLogRow } from '../money.types';

export type AuditListFilters = {
  entityType?: string;
  entityId?: number;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export class AuditLogsRepository {
  private base(workspaceId: number, filters: AuditListFilters) {
    let q = db(Tables.MONEY_AUDIT_LOGS).where({ workspace_id: workspaceId });
    if (filters.entityType) q = q.where({ entity_type: filters.entityType });
    if (filters.entityId != null) q = q.where({ entity_id: filters.entityId });
    if (filters.from) q = q.where('created_at', '>=', `${filters.from} 00:00:00`);
    if (filters.to) q = q.where('created_at', '<=', `${filters.to} 23:59:59`);
    return q;
  }

  async count(workspaceId: number, filters: AuditListFilters): Promise<number> {
    const row = await this.base(workspaceId, filters)
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async list(
    workspaceId: number,
    filters: AuditListFilters,
  ): Promise<MoneyAuditLogRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    return this.base(workspaceId, filters)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(filters.pageSize)
      .offset(offset)
      .select<MoneyAuditLogRow[]>('*');
  }
}

export const auditLogsRepository = new AuditLogsRepository();
