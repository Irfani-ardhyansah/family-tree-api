import type { Knex } from 'knex';
import db from '../../config/database';
import { Tables } from '../../shared/database/tables';

export type MoneyAuditAction = 'create' | 'update' | 'delete';

export function formatAuditRp(n: number): string {
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('id-ID');
  return n < 0 ? `Rp −${formatted}` : `Rp ${formatted}`;
}

export function txnAuditLabel(type: string): string {
  switch (type) {
    case 'income':
      return 'pemasukan';
    case 'expense':
      return 'pengeluaran';
    case 'opening_balance':
      return 'saldo awal';
    case 'adjustment':
      return 'penyesuaian';
    default:
      return type;
  }
}

export async function writeMoneyAudit(
  params: {
    workspaceId: number;
    actorPersonId: number;
    action: MoneyAuditAction;
    entityType: string;
    entityId: number;
    summary: string;
    before?: unknown;
    after?: unknown;
  },
  trx?: Knex.Transaction,
): Promise<void> {
  const summary = params.summary.trim();
  if (!summary) {
    throw new Error('Money audit summary wajib non-kosong.');
  }
  const q = trx ?? db;
  await q(Tables.MONEY_AUDIT_LOGS).insert({
    workspace_id: params.workspaceId,
    actor_person_id: params.actorPersonId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    summary,
    before: params.before == null ? null : JSON.stringify(params.before),
    after: params.after == null ? null : JSON.stringify(params.after),
  });
}
