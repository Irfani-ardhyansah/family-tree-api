import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Jadwal reset/gajian Money Track per workspace.
 *
 * - `period_start_mode`:
 *   - `fixed_day`    → tanggal tetap 1–31 (`period_start_day`).
 *   - `last_day`     → hari terakhir bulan.
 *   - `last_workday` → hari kerja terakhir bulan (Senin–Jumat).
 * - `period_weekend_adjust`: geser tanggal mulai kalau jatuh Sabtu/Minggu.
 * - Default = `fixed_day` + hari 1 + tanpa geser = perilaku lama (bulan kalender).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_PREFERENCES, (table) => {
    table
      .enum('period_start_mode', ['fixed_day', 'last_day', 'last_workday'])
      .notNullable()
      .defaultTo('fixed_day')
      .after('persons');
    table
      .tinyint('period_start_day')
      .unsigned()
      .notNullable()
      .defaultTo(1)
      .after('period_start_mode');
    table
      .enum('period_weekend_adjust', [
        'none',
        'previous_workday',
        'next_workday',
      ])
      .notNullable()
      .defaultTo('none')
      .after('period_start_day');
    // Nullable = [] (belum ada libur manual).
    table.json('period_holidays').nullable().after('period_weekend_adjust');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_PREFERENCES, (table) => {
    table.dropColumn('period_start_mode');
    table.dropColumn('period_start_day');
    table.dropColumn('period_weekend_adjust');
    table.dropColumn('period_holidays');
  });
}
