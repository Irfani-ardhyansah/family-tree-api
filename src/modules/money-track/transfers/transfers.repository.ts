import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyTransferRow } from '../money.types';

export class TransfersRepository {
  async findById(
    workspaceId: number,
    transferId: number,
  ): Promise<MoneyTransferRow | undefined> {
    return db(Tables.MONEY_TRANSFERS)
      .where({ id: transferId, workspace_id: workspaceId })
      .first<MoneyTransferRow>('*');
  }

  async create(input: {
    workspaceId: number;
    kind: string;
    fromPocketId: number;
    toPocketId: number;
    amount: number;
    date: string;
    note: string | null;
    createdByPersonId: number;
  }): Promise<MoneyTransferRow> {
    const [id] = await db(Tables.MONEY_TRANSFERS).insert({
      workspace_id: input.workspaceId,
      kind: input.kind,
      from_pocket_id: input.fromPocketId,
      to_pocket_id: input.toPocketId,
      amount: input.amount,
      date: input.date,
      note: input.note,
      created_by_person_id: input.createdByPersonId,
    });
    return (await this.findById(input.workspaceId, Number(id)))!;
  }

  async update(
    workspaceId: number,
    transferId: number,
    patch: Partial<{ amount: number; date: string; note: string | null }>,
  ): Promise<void> {
    await db(Tables.MONEY_TRANSFERS)
      .where({ id: transferId, workspace_id: workspaceId })
      .update({ ...patch, updated_at: db.fn.now() });
  }

  async delete(workspaceId: number, transferId: number): Promise<number> {
    return db(Tables.MONEY_TRANSFERS)
      .where({ id: transferId, workspace_id: workspaceId })
      .del();
  }

  async listRecent(workspaceId: number, limit: number): Promise<MoneyTransferRow[]> {
    return db(Tables.MONEY_TRANSFERS)
      .where({ workspace_id: workspaceId })
      .orderBy('date', 'desc')
      .orderBy('id', 'desc')
      .limit(limit)
      .select<MoneyTransferRow[]>('*');
  }
}

export const transfersRepository = new TransfersRepository();
