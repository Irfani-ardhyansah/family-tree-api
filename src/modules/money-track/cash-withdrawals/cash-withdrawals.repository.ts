import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyAccountRow, MoneyCashWithdrawalRow, MoneyPocketRow } from '../money.types';

export type CashWithdrawalListFilters = {
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export class CashWithdrawalsRepository {
  async findById(
    workspaceId: number,
    id: number,
  ): Promise<MoneyCashWithdrawalRow | undefined> {
    return db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ id, workspace_id: workspaceId })
      .first<MoneyCashWithdrawalRow>('*');
  }

  async create(input: {
    workspaceId: number;
    fromAccountId: number;
    fromPocketId: number;
    toCashAccountId: number;
    toCashPocketId: number;
    amount: number;
    date: string;
    note: string | null;
    attachmentMediaId: string | null;
    createdByPersonId: number;
  }): Promise<MoneyCashWithdrawalRow> {
    const [id] = await db(Tables.MONEY_CASH_WITHDRAWALS).insert({
      workspace_id: input.workspaceId,
      from_account_id: input.fromAccountId,
      from_pocket_id: input.fromPocketId,
      to_cash_account_id: input.toCashAccountId,
      to_cash_pocket_id: input.toCashPocketId,
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
    id: number,
    patch: Partial<{
      from_account_id: number;
      from_pocket_id: number;
      to_cash_account_id: number;
      to_cash_pocket_id: number;
      amount: number;
      date: string;
      note: string | null;
      attachment_media_id: string | null;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ id, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, id: number): Promise<number> {
    return db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ id, workspace_id: workspaceId })
      .del();
  }

  private baseList(workspaceId: number, filters: CashWithdrawalListFilters) {
    let q = db(Tables.MONEY_CASH_WITHDRAWALS).where({ workspace_id: workspaceId });
    if (filters.from) q = q.where('date', '>=', filters.from);
    if (filters.to) q = q.where('date', '<=', filters.to);
    return q;
  }

  async count(workspaceId: number, filters: CashWithdrawalListFilters): Promise<number> {
    const row = await this.baseList(workspaceId, filters)
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async list(
    workspaceId: number,
    filters: CashWithdrawalListFilters,
  ): Promise<MoneyCashWithdrawalRow[]> {
    const offset = (filters.page - 1) * filters.pageSize;
    return this.baseList(workspaceId, filters)
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
      .limit(filters.pageSize)
      .offset(offset)
      .select<MoneyCashWithdrawalRow[]>('*');
  }

  async listRecent(
    workspaceId: number,
    limit: number,
  ): Promise<MoneyCashWithdrawalRow[]> {
    return db(Tables.MONEY_CASH_WITHDRAWALS)
      .where({ workspace_id: workspaceId })
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .select<MoneyCashWithdrawalRow[]>('*');
  }

  async findCashAccountForPerson(
    workspaceId: number,
    personId: number,
  ): Promise<MoneyAccountRow | undefined> {
    return db(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId, person_id: personId, type: 'cash' })
      .first<MoneyAccountRow>('*');
  }

  async findTunaiPocket(
    workspaceId: number,
    cashAccountId: number,
  ): Promise<MoneyPocketRow | undefined> {
    return db(Tables.MONEY_POCKETS)
      .where({
        workspace_id: workspaceId,
        account_id: cashAccountId,
        is_system: true,
      })
      .whereNull('archived_at')
      .first<MoneyPocketRow>('*');
  }
}

export const cashWithdrawalsRepository = new CashWithdrawalsRepository();
