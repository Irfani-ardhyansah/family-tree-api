import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.REFRESH_TOKENS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('person_id').unsigned().notNullable();
    table.string('token_hash', 64).notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.index(['person_id'], 'core_refresh_tokens_person_id_idx');
    table.index(['expires_at'], 'core_refresh_tokens_expires_at_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.REFRESH_TOKENS);
}
