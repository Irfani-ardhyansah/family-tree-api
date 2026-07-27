import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.FAMILIES, (table) => {
    table.string('timezone', 64).notNullable().defaultTo('Asia/Jakarta');
    table.string('currency', 8).notNullable().defaultTo('IDR');
    table.string('logo_url', 512).nullable();
  });

  await knex.schema.createTable(Tables.BROADCASTS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.enum('target', ['all', 'selected']).notNullable();
    table.json('target_user_ids').nullable();
    table.timestamp('scheduled_at').nullable();
    table.timestamp('sent_at').nullable();
    table.enum('status', ['sent', 'scheduled', 'failed']).notNullable().defaultTo('scheduled');
    table.string('error_message', 512).nullable();
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table
      .foreign('created_by_person_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('CASCADE');
    table.index(['family_id', 'created_at'], 'core_broadcasts_family_created_idx');
    table.index(['status', 'scheduled_at'], 'core_broadcasts_status_scheduled_idx');
  });

  await knex.schema.createTable(Tables.NOTIFICATIONS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.bigInteger('broadcast_id').unsigned().nullable();
    table.string('title', 255).notNullable();
    table.text('body').notNullable();
    table.timestamp('read_at').nullable();
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.foreign('broadcast_id').references(`${Tables.BROADCASTS}.id`).onDelete('SET NULL');
    table.index(['person_id', 'created_at'], 'core_notifications_person_created_idx');
    table.index(['family_id', 'created_at'], 'core_notifications_family_created_idx');
  });

  await knex.schema.createTable(Tables.BACKUP_JOBS, (table) => {
    table.string('id', 40).primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table.json('module_ids').notNullable();
    table.enum('status', ['running', 'success', 'failed']).notNullable().defaultTo('running');
    table.string('storage_key', 512).nullable();
    table.string('error_message', 512).nullable();
    table.timestamps(true, true);
    table.timestamp('finished_at').nullable();

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table
      .foreign('created_by_person_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('CASCADE');
    table.index(['family_id', 'created_at'], 'core_backup_jobs_family_created_idx');
    table.index(['status', 'created_at'], 'core_backup_jobs_status_created_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.BACKUP_JOBS);
  await knex.schema.dropTableIfExists(Tables.NOTIFICATIONS);
  await knex.schema.dropTableIfExists(Tables.BROADCASTS);

  await knex.schema.alterTable(Tables.FAMILIES, (table) => {
    table.dropColumn('timezone');
    table.dropColumn('currency');
    table.dropColumn('logo_url');
  });
}
