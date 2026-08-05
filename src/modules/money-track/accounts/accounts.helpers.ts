import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyPocketRow } from '../money.types';

export async function createSystemPocketForAccount(input: {
  workspaceId: number;
  accountId: number;
  ownerPersonId: number;
  name: string;
}): Promise<MoneyPocketRow> {
  const [id] = await db(Tables.MONEY_POCKETS).insert({
    workspace_id: input.workspaceId,
    account_id: input.accountId,
    owner_type: 'person',
    owner_person_id: input.ownerPersonId,
    category: 'transaksi',
    name: input.name,
    goal_amount: null,
    goal_date: null,
    is_system: true,
    archived_at: null,
  });
  return (await db(Tables.MONEY_POCKETS).where({ id }).first<MoneyPocketRow>('*'))!;
}
