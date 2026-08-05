import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Hard-delete pockets and all ledger rows that reference them.
 * Uses FOREIGN_KEY_CHECKS off so RESTRICT FKs (txn/transfer/cash) do not block.
 */
export async function deletePocketsCascade(
  workspaceId: number,
  pocketIds: number[],
  trx: Knex.Transaction,
): Promise<void> {
  if (pocketIds.length === 0) return;

  await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await trx(Tables.MONEY_WISHLIST_ITEMS)
      .where({ workspace_id: workspaceId })
      .whereIn('linked_pocket_id', pocketIds)
      .update({ linked_pocket_id: null });

    await trx(Tables.MONEY_TRANSACTIONS)
      .where({ workspace_id: workspaceId })
      .whereIn('pocket_id', pocketIds)
      .del();

    await trx(Tables.MONEY_TRANSFERS)
      .where({ workspace_id: workspaceId })
      .where((qb) => {
        void qb.whereIn('from_pocket_id', pocketIds).orWhereIn('to_pocket_id', pocketIds);
      })
      .del();

    await trx(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ workspace_id: workspaceId })
      .where((qb) => {
        void qb
          .whereIn('from_pocket_id', pocketIds)
          .orWhereIn('to_cash_pocket_id', pocketIds);
      })
      .del();

    await trx(Tables.MONEY_POCKETS)
      .where({ workspace_id: workspaceId })
      .whereIn('id', pocketIds)
      .del();
  } finally {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
  }
}

/** Hard-delete an account and every pocket/ledger row under it. */
export async function deleteAccountCascade(
  workspaceId: number,
  accountId: number,
  trx: Knex.Transaction,
): Promise<void> {
  const pocketIds = (
    await trx(Tables.MONEY_POCKETS)
      .where({ workspace_id: workspaceId, account_id: accountId })
      .pluck<number[]>('id')
  ) as number[];

  await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
  try {
    await trx(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ workspace_id: workspaceId })
      .where((qb) => {
        void qb
          .where('from_account_id', accountId)
          .orWhere('to_cash_account_id', accountId);
      })
      .del();
  } finally {
    await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
  }

  await deletePocketsCascade(workspaceId, pocketIds, trx);

  await trx(Tables.MONEY_ACCOUNTS)
    .where({ id: accountId, workspace_id: workspaceId })
    .del();
}
