import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.SECONDARY_PASSWORDS, (table) => {
    table.integer('person_id').unsigned().primary();
    table.string('password_hash', 255).notNullable();
    table.timestamp('set_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.SECONDARY_PASSWORDS);
}
