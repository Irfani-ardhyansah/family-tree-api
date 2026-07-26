import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.MEDIA, (table) => {
    table.string('id', 40).primary();
    table.integer('uploader_person_id').unsigned().notNullable();
    table.foreign('uploader_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');

    table
      .enum('purpose', ['event', 'event_contribution', 'memoriam_tribute', 'person'])
      .notNullable();
    table.enum('status', ['pending', 'attached', 'deleted']).notNullable().defaultTo('pending');

    table.string('url', 500).notNullable();
    table.string('storage_key', 500).notNullable();
    table.string('mime_type', 64).notNullable();
    table.integer('size_bytes').unsigned().notNullable();
    table.integer('width').unsigned().nullable();
    table.integer('height').unsigned().nullable();

    table.string('context_id', 64).nullable();
    table
      .enum('attached_to_type', ['event', 'event_contribution', 'tribute', 'person'])
      .nullable();
    table.string('attached_to_id', 64).nullable();

    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.index(['uploader_person_id', 'status'], 'core_media_uploader_status_idx');
    table.index(['status', 'created_at'], 'core_media_status_created_idx');
    table.index(['family_id', 'status'], 'core_media_family_status_idx');
    table.index(['url'], 'core_media_url_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.MEDIA);
}
