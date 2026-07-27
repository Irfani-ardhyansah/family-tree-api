import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.PUSH_SUBSCRIPTIONS);

  await knex.schema.createTable(Tables.PUSH_SUBSCRIPTIONS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('person_id').unsigned().notNullable();
    table.integer('family_id').unsigned().notNullable();
    /** Full push endpoint URL (can be long — uniqueness via endpoint_hash). */
    table.text('endpoint').notNullable();
    table.string('endpoint_hash', 64).notNullable();
    table.string('p256dh', 255).notNullable();
    table.string('auth', 255).notNullable();
    table.string('user_agent', 512).nullable();
    table.timestamp('last_seen_at').nullable();
    table.timestamps(true, true);

    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.unique(['endpoint_hash'], 'core_push_subscriptions_endpoint_hash_uidx');
    table.index(['person_id'], 'core_push_subscriptions_person_id_idx');
    table.index(['family_id', 'person_id'], 'core_push_subscriptions_family_person_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.PUSH_SUBSCRIPTIONS);
}
