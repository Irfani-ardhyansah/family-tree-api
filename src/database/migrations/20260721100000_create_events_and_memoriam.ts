import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.EVENTS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');

    table.string('title', 200).notNullable();
    table
      .enum('type', ['wedding', 'birth', 'death', 'birthday', 'reunion', 'other'])
      .notNullable();
    table.date('date').notNullable();
    table.date('end_date').nullable();
    table.string('location', 500).nullable();
    table.text('description').nullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table.foreign('created_by_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');

    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.index(['family_id', 'deleted_at'], 'fr_events_family_deleted_idx');
    table.index(['family_id', 'date'], 'fr_events_family_date_idx');
    table.index(['family_id', 'type'], 'fr_events_family_type_idx');
  });

  await knex.schema.createTable(Tables.EVENT_PERSONS, (table) => {
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.foreign('event_id').references(`${Tables.EVENTS}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.primary(['event_id', 'person_id']);
    table.index(['person_id'], 'fr_event_persons_person_idx');
  });

  await knex.schema.createTable(Tables.EVENT_ATTENDEES, (table) => {
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.foreign('event_id').references(`${Tables.EVENTS}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.primary(['event_id', 'person_id']);
    table.index(['person_id'], 'fr_event_attendees_person_idx');
  });

  await knex.schema.createTable(Tables.EVENT_CONTRIBUTIONS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('contributor_person_id').unsigned().notNullable();
    table.foreign('event_id').references(`${Tables.EVENTS}.id`).onDelete('CASCADE');
    table
      .foreign('contributor_person_id')
      .references(`${Tables.PERSONS}.id`)
      .onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.string('caption', 500).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['event_id'], 'fr_event_contributions_event_idx');
  });

  await knex.schema.createTable(Tables.EVENT_PHOTOS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('event_id').unsigned().notNullable();
    table.foreign('event_id').references(`${Tables.EVENTS}.id`).onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index(['event_id', 'sort_order'], 'fr_event_photos_event_sort_idx');
  });

  await knex.schema.createTable(Tables.MEMORIAM_TRIBUTES, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('deceased_person_id').unsigned().notNullable();
    table.integer('author_person_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('deceased_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.foreign('author_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.text('content').notNullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();
    table.index(
      ['family_id', 'deceased_person_id', 'deleted_at'],
      'fr_memoriam_tributes_lookup_idx',
    );
  });

  await knex.schema.createTable(Tables.MEMORIAM_TRIBUTE_PHOTOS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('tribute_id').unsigned().notNullable();
    table
      .foreign('tribute_id')
      .references(`${Tables.MEMORIAM_TRIBUTES}.id`)
      .onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index(['tribute_id', 'sort_order'], 'fr_memoriam_tribute_photos_sort_idx');
  });

  await knex.schema.createTable(Tables.MEMORIAM_PRAYERS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('deceased_person_id').unsigned().notNullable();
    table.integer('author_person_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('deceased_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.foreign('author_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['deceased_person_id', 'author_person_id'], {
      indexName: 'fr_memoriam_prayers_deceased_author_unique',
    });
    table.index(['family_id', 'deceased_person_id'], 'fr_memoriam_prayers_lookup_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.MEMORIAM_PRAYERS);
  await knex.schema.dropTableIfExists(Tables.MEMORIAM_TRIBUTE_PHOTOS);
  await knex.schema.dropTableIfExists(Tables.MEMORIAM_TRIBUTES);
  await knex.schema.dropTableIfExists(Tables.EVENT_PHOTOS);
  await knex.schema.dropTableIfExists(Tables.EVENT_CONTRIBUTIONS);
  await knex.schema.dropTableIfExists(Tables.EVENT_ATTENDEES);
  await knex.schema.dropTableIfExists(Tables.EVENT_PERSONS);
  await knex.schema.dropTableIfExists(Tables.EVENTS);
}
