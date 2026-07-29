import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { CASH_POCKET_NAME } from '../money.constants';
import type { MoneyPocketRow } from '../money.types';

export async function createTunaiPocketForAccount(input: {
  workspaceId: number;
  accountId: number;
  ownerPersonId: number;
}): Promise<MoneyPocketRow> {
  const [id] = await db(Tables.MONEY_POCKETS).insert({
    workspace_id: input.workspaceId,
    account_id: input.accountId,
    owner_type: 'person',
    owner_person_id: input.ownerPersonId,
    category: 'transaksi',
    name: CASH_POCKET_NAME,
    goal_amount: null,
    goal_date: null,
    is_system: true,
    archived_at: null,
  });
  return (await db(Tables.MONEY_POCKETS).where({ id }).first<MoneyPocketRow>('*'))!;
}
