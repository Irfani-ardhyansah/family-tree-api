import type { Knex } from 'knex';

/**
 * No-op: `person` purpose is included in core_media create migration.
 * Kept so existing knex_migrations history stays consistent across environments.
 */
export async function up(_knex: Knex): Promise<void> {
  // intentionally empty
}

export async function down(_knex: Knex): Promise<void> {
  // intentionally empty
}
