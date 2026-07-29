import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyCategoryRow } from '../money.types';

export class CategoriesRepository {
  async list(
    workspaceId: number,
    type?: string,
  ): Promise<MoneyCategoryRow[]> {
    let q = db(Tables.MONEY_CATEGORIES)
      .where({ workspace_id: workspaceId })
      .whereNull('deleted_at')
      .orderBy('type', 'asc')
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc');
    if (type) {
      q = q.where({ type });
    }
    return q.select<MoneyCategoryRow[]>('*');
  }

  async findById(
    workspaceId: number,
    categoryId: number,
  ): Promise<MoneyCategoryRow | undefined> {
    return db(Tables.MONEY_CATEGORIES)
      .where({ id: categoryId, workspace_id: workspaceId })
      .whereNull('deleted_at')
      .first<MoneyCategoryRow>('*');
  }

  async create(input: {
    workspaceId: number;
    name: string;
    type: string;
    icon: string | null;
    sortOrder: number;
  }): Promise<MoneyCategoryRow> {
    const [id] = await db(Tables.MONEY_CATEGORIES).insert({
      workspace_id: input.workspaceId,
      name: input.name,
      type: input.type,
      icon: input.icon,
      sort_order: input.sortOrder,
      is_system: false,
    });
    return (await this.findById(input.workspaceId, id))!;
  }

  async update(
    workspaceId: number,
    categoryId: number,
    patch: Partial<{
      name: string;
      icon: string | null;
      sort_order: number;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_CATEGORIES)
      .where({ id: categoryId, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async softDelete(workspaceId: number, categoryId: number): Promise<void> {
    await db(Tables.MONEY_CATEGORIES)
      .where({ id: categoryId, workspace_id: workspaceId })
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
  }

  async countTransactions(categoryId: number): Promise<number> {
    const row = await db(Tables.MONEY_TRANSACTIONS)
      .where({ category_id: categoryId })
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async maxSortOrder(workspaceId: number, type: string): Promise<number> {
    const row = await db(Tables.MONEY_CATEGORIES)
      .where({ workspace_id: workspaceId, type })
      .whereNull('deleted_at')
      .max<{ max: number | string | null }>({ max: 'sort_order' })
      .first();
    return Number(row?.max ?? 0);
  }
}

export const categoriesRepository = new CategoriesRepository();
