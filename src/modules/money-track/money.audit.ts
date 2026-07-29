import type { Knex } from 'knex';
import db from '../../config/database';
import { Tables } from '../../shared/database/tables';

export type MoneyAuditAction = 'create' | 'update' | 'delete';

export async function writeMoneyAudit(
  params: {
    workspaceId: number;
    actorPersonId: number;
    action: MoneyAuditAction;
    entityType: string;
    entityId: number;
    before?: unknown;
    after?: unknown;
  },
  trx?: Knex.Transaction,
): Promise<void> {
  const q = trx ?? db;
  await q(Tables.MONEY_AUDIT_LOGS).insert({
    workspace_id: params.workspaceId,
    actor_person_id: params.actorPersonId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before: params.before == null ? null : JSON.stringify(params.before),
    after: params.after == null ? null : JSON.stringify(params.after),
  });
}
