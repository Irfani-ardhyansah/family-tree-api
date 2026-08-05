import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_WORKSPACES, (table) => {
    table.boolean('has_sample_data').notNullable().defaultTo(false);
  });

  // Existing workspaces in this project are typically from the demo seed.
  await knex(Tables.MONEY_WORKSPACES).update({ has_sample_data: true });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_WORKSPACES, (table) => {
    table.dropColumn('has_sample_data');
  });
}
