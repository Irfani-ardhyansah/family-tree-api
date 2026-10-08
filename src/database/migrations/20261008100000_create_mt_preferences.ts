import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Preferensi Money Track per workspace (default kantong/kategori, nominal cepat).
 *
 * - 1 baris per workspace. Override per-person disimpan di kolom JSON `persons`
 *   (key = mt_persons.id) supaya tidak perlu tabel tambahan.
 * - `shared` = default scope "Gabungan".
 * - FK workspace ON DELETE CASCADE; preferensi ikut terhapus saat workspace dihapus.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.MONEY_PREFERENCES, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('workspace_id').unsigned().notNullable();
    table
      .foreign('workspace_id', 'mt_preferences_workspace_fk')
      .references(`${Tables.MONEY_WORKSPACES}.id`)
      .onDelete('CASCADE');
    table
      .enum('default_tx_type', ['expense', 'income'])
      .notNullable()
      .defaultTo('expense');
    table.json('quick_amounts').notNullable();
    table.json('shared').notNullable();
    table.json('persons').notNullable();
    table.timestamps(true, true);
    table.unique(['workspace_id'], {
      indexName: 'mt_preferences_workspace_unique',
    });
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.MONEY_PREFERENCES);
}
