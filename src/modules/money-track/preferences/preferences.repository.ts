import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type { MoneyPeriodSettings, MoneyPreferencesRow } from '../money.types';
import { toPeriodSettings } from './preferences.helpers';

export class PreferencesRepository {
  async findByWorkspace(
    workspaceId: number,
  ): Promise<MoneyPreferencesRow | undefined> {
    return db(Tables.MONEY_PREFERENCES)
      .where({ workspace_id: workspaceId })
      .first<MoneyPreferencesRow>('*');
  }

  /** Setting periode untuk perhitungan dashboard/report/budget/reminder. */
  async getPeriodSettings(workspaceId: number): Promise<MoneyPeriodSettings> {
    return toPeriodSettings(await this.findByWorkspace(workspaceId));
  }

  async upsert(input: {
    workspaceId: number;
    defaultTxType: string;
    quickAmounts: number[];
    shared: unknown;
    persons: unknown;
    period: MoneyPeriodSettings;
  }): Promise<MoneyPreferencesRow> {
    const payload = {
      default_tx_type: input.defaultTxType,
      quick_amounts: JSON.stringify(input.quickAmounts),
      shared: JSON.stringify(input.shared),
      persons: JSON.stringify(input.persons),
      period_start_mode: input.period.startMode,
      period_start_day: input.period.startDay,
      period_weekend_adjust: input.period.weekendAdjust,
      period_holidays: JSON.stringify(input.period.holidays),
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
