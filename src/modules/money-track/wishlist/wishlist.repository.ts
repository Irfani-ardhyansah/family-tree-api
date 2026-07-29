import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyWishlistRow } from '../money.types';

export class WishlistRepository {
  async list(workspaceId: number): Promise<MoneyWishlistRow[]> {
    return db(Tables.MONEY_WISHLIST_ITEMS)
      .where({ workspace_id: workspaceId })
      .orderBy('id', 'desc')
      .select<MoneyWishlistRow[]>('*');
  }

  async findById(
    workspaceId: number,
    id: number,
  ): Promise<MoneyWishlistRow | undefined> {
    return db(Tables.MONEY_WISHLIST_ITEMS)
      .where({ id, workspace_id: workspaceId })
      .first<MoneyWishlistRow>('*');
  }

  async create(input: {
    workspaceId: number;
    personId: number | null;
    name: string;
    estimatedPrice: number;
    priority: string;
    linkedPocketId: number | null;
    imageMediaId: string | null;
  }): Promise<MoneyWishlistRow> {
    const [id] = await db(Tables.MONEY_WISHLIST_ITEMS).insert({
      workspace_id: input.workspaceId,
      person_id: input.personId,
      name: input.name,
      estimated_price: input.estimatedPrice,
      priority: input.priority,
      linked_pocket_id: input.linkedPocketId,
      image_media_id: input.imageMediaId,
      purchased_at: null,
    });
    return (await this.findById(input.workspaceId, id))!;
  }

  async update(
    workspaceId: number,
    id: number,
    patch: Partial<{
      person_id: number | null;
      name: string;
      estimated_price: number;
      priority: string;
      linked_pocket_id: number | null;
      image_media_id: string | null;
      purchased_at: Date | null;
    }>,
  ): Promise<void> {
    await db(Tables.MONEY_WISHLIST_ITEMS)
      .where({ id, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, id: number): Promise<number> {
    return db(Tables.MONEY_WISHLIST_ITEMS)
      .where({ id, workspace_id: workspaceId })
      .del();
  }
}

export const wishlistRepository = new WishlistRepository();
