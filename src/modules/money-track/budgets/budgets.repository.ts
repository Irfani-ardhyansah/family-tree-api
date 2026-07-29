import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyBudgetRow } from '../money.types';

export class BudgetsRepository {
  async listByMonth(workspaceId: number, yearMonth: string): Promise<MoneyBudgetRow[]> {
    return db(Tables.MONEY_BUDGETS)
      .where({ workspace_id: workspaceId, year_month: yearMonth })
      .orderBy('id', 'asc')
      .select<MoneyBudgetRow[]>('*');
  }

  async upsert(input: {
    workspaceId: number;
    categoryId: number;
    yearMonth: string;
    limitAmount: number;
  }): Promise<MoneyBudgetRow> {
    const existing = await db(Tables.MONEY_BUDGETS)
      .where({
        workspace_id: input.workspaceId,
        category_id: input.categoryId,
        year_month: input.yearMonth,
      })
      .first<MoneyBudgetRow>('*');

    if (existing) {
      await db(Tables.MONEY_BUDGETS)
        .where({ id: existing.id })
        .update({ limit_amount: input.limitAmount, updated_at: db.fn.now() });
      return (await db(Tables.MONEY_BUDGETS)
        .where({ id: existing.id })
        .first<MoneyBudgetRow>('*'))!;
    }

    const [id] = await db(Tables.MONEY_BUDGETS).insert({
      workspace_id: input.workspaceId,
      category_id: input.categoryId,
      year_month: input.yearMonth,
      limit_amount: input.limitAmount,
    });
    return (await db(Tables.MONEY_BUDGETS).where({ id }).first<MoneyBudgetRow>('*'))!;
  }

  async sumExpenseForCategory(
    workspaceId: number,
    categoryId: number,
    from: string,
    to: string,
  ): Promise<number> {
    const row = await db(Tables.MONEY_TRANSACTIONS)
      .where({
        workspace_id: workspaceId,
        category_id: categoryId,
        type: 'expense',
      })
      .whereBetween('date', [from, to])
      .sum<{ total: number | string | null }>({ total: 'amount' })
      .first();
    return Number(row?.total ?? 0);
  }
}

export const budgetsRepository = new BudgetsRepository();
