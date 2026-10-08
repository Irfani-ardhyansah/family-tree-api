import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyPreferencesRow } from '../money.types';

export class PreferencesRepository {
  async findByWorkspace(
    workspaceId: number,
  ): Promise<MoneyPreferencesRow | undefined> {
    return db(Tables.MONEY_PREFERENCES)
      .where({ workspace_id: workspaceId })
      .first<MoneyPreferencesRow>('*');
  }

  async upsert(input: {
    workspaceId: number;
    defaultTxType: string;
    quickAmounts: number[];
    shared: unknown;
    persons: unknown;
  }): Promise<MoneyPreferencesRow> {
    const payload = {
      default_tx_type: input.defaultTxType,
      quick_amounts: JSON.stringify(input.quickAmounts),
      shared: JSON.stringify(input.shared),
      persons: JSON.stringify(input.persons),
    };

    const existing = await this.findByWorkspace(input.workspaceId);
    if (existing) {
      await db(Tables.MONEY_PREFERENCES)
        .where({ id: existing.id })
        .update({ ...payload, updated_at: db.fn.now() });
      return (await this.findByWorkspace(input.workspaceId))!;
    }

    const [id] = await db(Tables.MONEY_PREFERENCES).insert({
      workspace_id: input.workspaceId,
      ...payload,
    });
    return (await db(Tables.MONEY_PREFERENCES)
      .where({ id })
      .first<MoneyPreferencesRow>('*'))!;
  }
}

export const preferencesRepository = new PreferencesRepository();
