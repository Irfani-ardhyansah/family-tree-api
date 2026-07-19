import type { Knex } from 'knex';

/**
 * Unified application log store.
 * Covers API CRUD/audit, auth events, FE navigation/clicks, and system errors.
 *
 * See docs/DATABASE-DESIGN.md#app_logs
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('app_logs', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());

    table
      .enum('category', ['audit', 'navigation', 'auth', 'system', 'error'])
      .notNullable();
    table.string('action', 64).notNullable();
    table.enum('status', ['success', 'failure']).notNullable().defaultTo('success');

    table.integer('actor_person_id').unsigned().nullable();
    table.integer('family_id').unsigned().nullable();

    table.string('resource_type', 32).nullable();
    table.integer('resource_id').unsigned().nullable();

    table.string('http_method', 16).nullable();
    table.string('path', 512).nullable();
    table.smallint('http_status').unsigned().nullable();

    table.string('message', 512).nullable();
    table.json('metadata').nullable();

    table.string('ip_address', 45).nullable();
    table.string('user_agent', 512).nullable();
    table.string('request_id', 36).nullable();

    table.foreign('actor_person_id').references('persons.id').onDelete('SET NULL');
    table.foreign('family_id').references('families.id').onDelete('SET NULL');

    table.index(['occurred_at'], 'app_logs_occurred_at_idx');
    table.index(['category', 'occurred_at'], 'app_logs_category_occurred_idx');
    table.index(['action', 'occurred_at'], 'app_logs_action_occurred_idx');
    table.index(['actor_person_id', 'occurred_at'], 'app_logs_actor_occurred_idx');
    table.index(['family_id', 'occurred_at'], 'app_logs_family_occurred_idx');
    table.index(['resource_type', 'resource_id'], 'app_logs_resource_idx');
    table.index(['request_id'], 'app_logs_request_id_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('app_logs');
}
