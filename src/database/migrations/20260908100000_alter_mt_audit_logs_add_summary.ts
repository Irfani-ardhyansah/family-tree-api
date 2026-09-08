import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_AUDIT_LOGS, (table) => {
    table.string('summary', 255).notNullable().defaultTo('');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_AUDIT_LOGS, (table) => {
    table.dropColumn('summary');
  });
}
