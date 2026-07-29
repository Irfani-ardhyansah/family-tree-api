import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  asNumber,
  parseAmount,
  parsePositiveInt,
  resolveMoneyContext,
} from '../money.access';
import { monthDateRange, parseYearMonth } from '../money.helpers';
import type { MoneyBudgetDto } from '../money.types';
import { categoriesRepository } from '../categories/categories.repository';
import { budgetsRepository } from './budgets.repository';

export class BudgetsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyBudgetDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (query.yearMonth === undefined) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'yearMonth wajib.');
    }
    const yearMonth = parseYearMonth(query.yearMonth, 'yearMonth');
    return this.buildDtos(ctx.workspace.id, yearMonth);
  }

  async upsert(
    authPersonId: number,
    familyId: number,
    body: unknown,
  ): Promise<MoneyBudgetDto[]> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const yearMonth = parseYearMonth(raw.yearMonth, 'yearMonth');
    if (!Array.isArray(raw.items) || raw.items.length === 0) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'items wajib diisi.');
    }

    for (let i = 0; i < raw.items.length; i += 1) {
      const item = raw.items[i];
      if (!item || typeof item !== 'object') {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `items[${i}] tidak valid.`);
      }
      const row = item as Record<string, unknown>;
      const categoryId = parsePositiveInt(row.categoryId, `items[${i}].categoryId`);
      const limitAmount = parseAmount(row.limitAmount, `items[${i}].limitAmount`);
      const category = await categoriesRepository.findById(ctx.workspace.id, categoryId);
      if (!category || category.type !== 'expense') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `items[${i}].categoryId harus kategori expense aktif.`,
        );
      }
      await budgetsRepository.upsert({
        workspaceId: ctx.workspace.id,
        categoryId,
        yearMonth,
        limitAmount,
      });
    }

    return this.buildDtos(ctx.workspace.id, yearMonth);
  }

  private async buildDtos(workspaceId: number, yearMonth: string): Promise<MoneyBudgetDto[]> {
    const { from, to } = monthDateRange(yearMonth);
    const rows = await budgetsRepository.listByMonth(workspaceId, yearMonth);
    const categories = await categoriesRepository.list(workspaceId, 'expense');
    const catMap = new Map(categories.map((c) => [c.id, c]));

    return Promise.all(
      rows.map(async (row) => {
        const spentAmount = await budgetsRepository.sumExpenseForCategory(
          workspaceId,
          row.category_id,
          from,
          to,
        );
        const limitAmount = asNumber(row.limit_amount) ?? 0;
        const remaining = limitAmount - spentAmount;
        const pctUsed =
          limitAmount > 0 ? Math.round((spentAmount / limitAmount) * 100) : 0;
        return {
          id: row.id,
          categoryId: row.category_id,
          categoryName: catMap.get(row.category_id)?.name ?? '',
          yearMonth: row.year_month,
          limitAmount,
          spentAmount,
          remaining,
          pctUsed,
        };
      }),
    );
  }
}

export const budgetsService = new BudgetsService();
