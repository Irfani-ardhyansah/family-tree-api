import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

const MODULE_IDS = ['roots', 'core', 'money', 'household'] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.FAMILIES, (table) => {
    table.integer('access_version').unsigned().notNullable().defaultTo(1);
  });

  await knex.schema.alterTable(Tables.REFRESH_TOKENS, (table) => {
    table.integer('family_id').unsigned().nullable();
    table.string('device', 128).nullable();
    table.string('browser', 128).nullable();
    table.string('ip_address', 45).nullable();
    table.timestamp('last_active_at').nullable();

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('SET NULL');
    table.index(['family_id'], 'core_refresh_tokens_family_id_idx');
    table.index(['family_id', 'revoked_at'], 'core_refresh_tokens_family_revoked_idx');
  });

  await knex.schema.createTable(Tables.MODULE_STATUSES, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.enum('module_id', MODULE_IDS).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.integer('updated_by_person_id').unsigned().nullable();
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table
      .foreign('updated_by_person_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('SET NULL');
    table.unique(['family_id', 'module_id'], 'core_module_statuses_family_module_uidx');
    table.index(['family_id'], 'core_module_statuses_family_id_idx');
  });

  await knex.schema.createTable(Tables.ADMIN_AUDIT_LOGS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('actor_person_id').unsigned().nullable();
    table.string('module_id', 32).notNullable();
    table.string('action', 64).notNullable();
    table.string('summary', 512).notNullable();
    table.json('before').nullable();
    table.json('after').nullable();
    table.timestamp('occurred_at').notNullable().defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('actor_person_id').references(`${Tables.PERSONS}.id`).onDelete('SET NULL');
    table.index(['family_id', 'occurred_at'], 'core_admin_audit_logs_family_occurred_idx');
    table.index(['family_id', 'action'], 'core_admin_audit_logs_family_action_idx');
    table.index(['family_id', 'module_id'], 'core_admin_audit_logs_family_module_idx');
    table.index(['actor_person_id', 'occurred_at'], 'core_admin_audit_logs_actor_occurred_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.ADMIN_AUDIT_LOGS);
  await knex.schema.dropTableIfExists(Tables.MODULE_STATUSES);

  await knex.schema.alterTable(Tables.REFRESH_TOKENS, (table) => {
    table.dropIndex(['family_id', 'revoked_at'], 'core_refresh_tokens_family_revoked_idx');
    table.dropIndex(['family_id'], 'core_refresh_tokens_family_id_idx');
    table.dropForeign(['family_id']);
    table.dropColumn('family_id');
    table.dropColumn('device');
    table.dropColumn('browser');
    table.dropColumn('ip_address');
    table.dropColumn('last_active_at');
  });

  await knex.schema.alterTable(Tables.FAMILIES, (table) => {
    table.dropColumn('access_version');
  });
}
