import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyDebtPaymentRow, MoneyDebtRow } from '../money.types';

export class DebtsRepository {
  async list(
    workspaceId: number,
    filters: { status?: string; direction?: string },
  ): Promise<MoneyDebtRow[]> {
    let q = db(Tables.MONEY_DEBTS)
      .where({ workspace_id: workspaceId })
      .orderBy('id', 'desc');
    if (filters.status) q = q.where({ status: filters.status });
    if (filters.direction) q = q.where({ direction: filters.direction });
    return q.select<MoneyDebtRow[]>('*');
  }

  async findById(workspaceId: number, id: number): Promise<MoneyDebtRow | undefined> {
    return db(Tables.MONEY_DEBTS)
      .where({ id, workspace_id: workspaceId })
      .first<MoneyDebtRow>('*');
  }

  async create(input: {
    workspaceId: number;
    personId: number;
    counterpartyName: string;
    direction: string;
    amount: number;
    date: string;
    dueDate: string | null;
    note: string | null;
  }): Promise<MoneyDebtRow> {
    const [id] = await db(Tables.MONEY_DEBTS).insert({
      workspace_id: input.workspaceId,
      person_id: input.personId,
      counterparty_name: input.counterpartyName,
      direction: input.direction,
      amount: input.amount,
      date: input.date,
      due_date: input.dueDate,
      status: 'open',
      note: input.note,
    });
    return (await this.findById(input.workspaceId, id))!;
  }

  async update(
    workspaceId: number,
    id: number,
    patch: Partial<{
      person_id: number;
      counterparty_name: string;
      direction: string;
      amount: number;
      date: string;
      due_date: string | null;
      note: string | null;
      status: string;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_DEBTS)
      .where({ id, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, id: number): Promise<number> {
    return db(Tables.MONEY_DEBTS).where({ id, workspace_id: workspaceId }).del();
  }

  async listPayments(debtId: number): Promise<MoneyDebtPaymentRow[]> {
    return db(Tables.MONEY_DEBT_PAYMENTS)
      .where({ debt_id: debtId })
      .orderBy('date', 'asc')
      .orderBy('id', 'asc')
      .select<MoneyDebtPaymentRow[]>('*');
  }

  async sumPayments(debtId: number): Promise<number> {
    const row = await db(Tables.MONEY_DEBT_PAYMENTS)
      .where({ debt_id: debtId })
      .sum<{ total: number | string | null }>({ total: 'amount' })
      .first();
    return Number(row?.total ?? 0);
  }

  async createPayment(input: {
    workspaceId: number;
    debtId: number;
    amount: number;
    date: string;
    note: string | null;
    createdByPersonId: number;
  }): Promise<MoneyDebtPaymentRow> {
    const [id] = await db(Tables.MONEY_DEBT_PAYMENTS).insert({
      workspace_id: input.workspaceId,
      debt_id: input.debtId,
      amount: input.amount,
      date: input.date,
      note: input.note,
      created_by_person_id: input.createdByPersonId,
    });
    return (await db(Tables.MONEY_DEBT_PAYMENTS)
      .where({ id })
      .first<MoneyDebtPaymentRow>('*'))!;
  }

  async listOpenWithDue(workspaceId: number): Promise<MoneyDebtRow[]> {
    return db(Tables.MONEY_DEBTS)
      .where({ workspace_id: workspaceId })
      .whereIn('status', ['open', 'partial'])
      .whereNotNull('due_date')
      .select<MoneyDebtRow[]>('*');
  }
}

export const debtsRepository = new DebtsRepository();
