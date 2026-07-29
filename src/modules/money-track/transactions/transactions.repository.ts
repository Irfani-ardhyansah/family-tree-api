import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyTransactionRow } from '../money.types';

export type TransactionListFilters = {
  from?: string;
  to?: string;
  personId?: number;
  pocketId?: number;
  type?: string;
  categoryId?: number;
  q?: string;
  uncategorized?: boolean;
  page: number;
  pageSize: number;
};

export class TransactionsRepository {
  private baseListQuery(workspaceId: number, filters: TransactionListFilters) {
    let q = db(Tables.MONEY_TRANSACTIONS).where(
      `${Tables.MONEY_TRANSACTIONS}.workspace_id`,
      workspaceId,
    );

    if (filters.from) {
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.date`, '>=', filters.from);
    }
    if (filters.to) {
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.date`, '<=', filters.to);
    }
    if (filters.pocketId != null) {
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.pocket_id`, filters.pocketId);
    }
    if (filters.type) {
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.type`, filters.type);
    }
    if (filters.uncategorized) {
      q = q.whereNull(`${Tables.MONEY_TRANSACTIONS}.category_id`);
    } else if (filters.categoryId != null) {
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.category_id`, filters.categoryId);
    }
    if (filters.q) {
      const like = `%${filters.q}%`;
      q = q.where(`${Tables.MONEY_TRANSACTIONS}.note`, 'like', like);
    }
    if (filters.personId != null) {
      q = q
        .join(
          Tables.MONEY_POCKETS,
          `${Tables.MONEY_POCKETS}.id`,
          `${Tables.MONEY_TRANSACTIONS}.pocket_id`,
        )
        .where(`${Tables.MONEY_POCKETS}.owner_person_id`, filters.personId);
    }

    return q;
  }

  async count(workspaceId: number, filters: TransactionListFilters): Promise<number> {
    const row = await this.baseListQuery(workspaceId, filters)
      .countDistinct<{ total: number | string }>({
        total: `${Tables.MONEY_TRANSACTIONS}.id`,
      })
      .first();
    return Number(row?.total ?? 0);
  }

  async list(
    workspaceId: number,
    filters: TransactionListFilters,
  ): Promise<MoneyTransactionRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    return this.baseListQuery(workspaceId, filters)
      .select(`${Tables.MONEY_TRANSACTIONS}.*`)
      .orderBy(`${Tables.MONEY_TRANSACTIONS}.date`, 'desc')
      .orderBy(`${Tables.MONEY_TRANSACTIONS}.id`, 'desc')
      .limit(filters.pageSize)
      .offset(offset);
  }

  async findById(
    workspaceId: number,
    transactionId: number,
  ): Promise<MoneyTransactionRow | undefined> {
    return db(Tables.MONEY_TRANSACTIONS)
      .where({ id: transactionId, workspace_id: workspaceId })
      .first<MoneyTransactionRow>('*');
  }

  async create(input: {
    workspaceId: number;
    pocketId: number;
    categoryId: number | null;
    type: string;
    amount: number;
    date: string;
    note: string | null;
    attachmentMediaId: string | null;
    createdByPersonId: number;
  }): Promise<MoneyTransactionRow> {
    const [id] = await db(Tables.MONEY_TRANSACTIONS).insert({
      workspace_id: input.workspaceId,
      pocket_id: input.pocketId,
      category_id: input.categoryId,
      type: input.type,
      amount: input.amount,
      date: input.date,
      note: input.note,
      attachment_media_id: input.attachmentMediaId,
      created_by_person_id: input.createdByPersonId,
    });
    return (await this.findById(input.workspaceId, Number(id)))!;
  }

  async update(
    workspaceId: number,
    transactionId: number,
    patch: Partial<{
      pocket_id: number;
      category_id: number | null;
      type: string;
      amount: number;
      date: string;
      note: string | null;
      attachment_media_id: string | null;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_TRANSACTIONS)
      .where({ id: transactionId, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, transactionId: number): Promise<number> {
    return db(Tables.MONEY_TRANSACTIONS)
      .where({ id: transactionId, workspace_id: workspaceId })
      .del();
  }

  async countOpeningForPocket(pocketId: number): Promise<number> {
    const row = await db(Tables.MONEY_TRANSACTIONS)
      .where({ pocket_id: pocketId, type: 'opening_balance' })
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }
}

export const transactionsRepository = new TransactionsRepository();
