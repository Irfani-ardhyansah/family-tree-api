import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Pengaturan Pembersihan Otomatis (admin auto cleanup).
 *
 * 1 baris per keluarga. `targets` = JSON boolean per jenis data; `last_result`
 * = ringkasan hasil run terakhir. Idempotent (guard `hasTable`).
 */
export async function up(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(Tables.AUTO_CLEANUP_SETTINGS)) return;

  await knex.schema.createTable(Tables.AUTO_CLEANUP_SETTINGS, (table) => {
    table.integer('family_id').unsigned().primary();
    table
      .foreign('family_id')
      .references(`${Tables.FAMILIES}.id`)
      .onDelete('CASCADE');
    table.boolean('enabled').notNullable().defaultTo(false);
    table.integer('retention_days').notNullable().defaultTo(14);
    table.json('targets').notNullable();
    table.timestamp('last_run_at').nullable();
    table.json('last_result').nullable();
    table.integer('updated_by').unsigned().nullable();
    table
      .foreign('updated_by')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('SET NULL');
    table.timestamps(true, true);

    table.index(['enabled'], 'core_auto_cleanup_enabled_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.AUTO_CLEANUP_SETTINGS);
}
