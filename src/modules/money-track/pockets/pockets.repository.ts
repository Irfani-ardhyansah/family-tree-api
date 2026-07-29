import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyAccountRow, MoneyPocketRow } from '../money.types';

export class PocketsRepository {
  async list(
    workspaceId: number,
    filters: { personId?: number; ownerType?: string; includeArchived?: boolean },
  ): Promise<MoneyPocketRow[]> {
    let q = db(Tables.MONEY_POCKETS)
      .where(`${Tables.MONEY_POCKETS}.workspace_id`, workspaceId)
      .orderBy(`${Tables.MONEY_POCKETS}.id`, 'asc');

    if (!filters.includeArchived) {
      q = q.whereNull(`${Tables.MONEY_POCKETS}.archived_at`);
    }
    if (filters.ownerType) {
      q = q.where(`${Tables.MONEY_POCKETS}.owner_type`, filters.ownerType);
    }
    if (filters.personId != null) {
      q = q.where(`${Tables.MONEY_POCKETS}.owner_person_id`, filters.personId);
    }

    return q.select<MoneyPocketRow[]>(`${Tables.MONEY_POCKETS}.*`);
  }

  async findById(
    workspaceId: number,
    pocketId: number,
  ): Promise<MoneyPocketRow | undefined> {
    return db(Tables.MONEY_POCKETS)
      .where({ id: pocketId, workspace_id: workspaceId })
      .first<MoneyPocketRow>('*');
  }

  async findAccount(
    workspaceId: number,
    accountId: number,
  ): Promise<MoneyAccountRow | undefined> {
    return db(Tables.MONEY_ACCOUNTS)
      .where({ id: accountId, workspace_id: workspaceId })
      .first<MoneyAccountRow>('*');
  }

  async findAccountsByIds(
    workspaceId: number,
    accountIds: number[],
  ): Promise<MoneyAccountRow[]> {
    if (accountIds.length === 0) return [];
    return db(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId })
      .whereIn('id', accountIds)
      .select<MoneyAccountRow[]>('*');
  }

  async create(input: {
    workspaceId: number;
    accountId: number;
    ownerType: string;
    ownerPersonId: number | null;
    category: string;
    name: string;
    goalAmount: number | null;
    goalDate: string | null;
  }): Promise<MoneyPocketRow> {
    const [id] = await db(Tables.MONEY_POCKETS).insert({
      workspace_id: input.workspaceId,
      account_id: input.accountId,
      owner_type: input.ownerType,
      owner_person_id: input.ownerPersonId,
      category: input.category,
      name: input.name,
      goal_amount: input.goalAmount,
      goal_date: input.goalDate,
      is_system: false,
      archived_at: null,
    });
    return (await this.findById(input.workspaceId, id))!;
  }

  async update(
    workspaceId: number,
    pocketId: number,
    patch: Partial<{
      name: string;
      category: string;
      goal_amount: number | null;
      goal_date: string | null;
      archived_at: Date | null;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_POCKETS)
      .where({ id: pocketId, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }
}

export const pocketsRepository = new PocketsRepository();
