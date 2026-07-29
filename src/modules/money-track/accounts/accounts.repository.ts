import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyAccountRow } from '../money.types';

export class AccountsRepository {
  async list(
    workspaceId: number,
    personId?: number,
  ): Promise<MoneyAccountRow[]> {
    let q = db(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId })
      .orderBy('id', 'asc');
    if (personId != null) {
      q = q.where({ person_id: personId });
    }
    return q.select<MoneyAccountRow[]>('*');
  }

  async findById(
    workspaceId: number,
    accountId: number,
  ): Promise<MoneyAccountRow | undefined> {
    return db(Tables.MONEY_ACCOUNTS)
      .where({ id: accountId, workspace_id: workspaceId })
      .first<MoneyAccountRow>('*');
  }

  async create(input: {
    workspaceId: number;
    personId: number;
    name: string;
    type: string;
    bankName: string | null;
  }): Promise<MoneyAccountRow> {
    const [id] = await db(Tables.MONEY_ACCOUNTS).insert({
      workspace_id: input.workspaceId,
      person_id: input.personId,
      name: input.name,
      type: input.type,
      bank_name: input.bankName,
    });
    return (await this.findById(input.workspaceId, id))!;
  }

  async update(
    workspaceId: number,
    accountId: number,
    patch: Partial<{ name: string; bank_name: string | null }>,
  ): Promise<void> {
    await db(Tables.MONEY_ACCOUNTS)
      .where({ id: accountId, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, accountId: number): Promise<number> {
    return db(Tables.MONEY_ACCOUNTS)
      .where({ id: accountId, workspace_id: workspaceId })
      .del();
  }

  async countCashForPerson(workspaceId: number, personId: number): Promise<number> {
    const row = await db(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId, person_id: personId, type: 'cash' })
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async countPockets(accountId: number): Promise<number> {
    const row = await db(Tables.MONEY_POCKETS)
      .where({ account_id: accountId })
      .whereNull('archived_at')
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async listPocketIds(accountId: number): Promise<number[]> {
    const rows = await db(Tables.MONEY_POCKETS)
      .where({ account_id: accountId })
      .select<{ id: number }[]>('id');
    return rows.map((r) => r.id);
  }
}

export const accountsRepository = new AccountsRepository();
