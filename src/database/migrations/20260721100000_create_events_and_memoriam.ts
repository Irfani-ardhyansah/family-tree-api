import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('family_events', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references('families.id').onDelete('CASCADE');

    table.string('title', 200).notNullable();
    table
      .enum('type', ['wedding', 'birth', 'death', 'birthday', 'reunion', 'other'])
      .notNullable();
    table.date('date').notNullable();
    table.date('end_date').nullable();
    table.string('location', 500).nullable();
    table.text('description').nullable();
    table.integer('created_by_person_id').unsigned().notNullable();
    table.foreign('created_by_person_id').references('persons.id').onDelete('CASCADE');

    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.index(['family_id', 'deleted_at'], 'family_events_family_deleted_idx');
    table.index(['family_id', 'date'], 'family_events_family_date_idx');
    table.index(['family_id', 'type'], 'family_events_family_type_idx');
  });

  await knex.schema.createTable('family_event_persons', (table) => {
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.foreign('event_id').references('family_events.id').onDelete('CASCADE');
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');
    table.primary(['event_id', 'person_id']);
    table.index(['person_id'], 'family_event_persons_person_idx');
  });

  await knex.schema.createTable('family_event_attendees', (table) => {
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.foreign('event_id').references('family_events.id').onDelete('CASCADE');
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');
    table.primary(['event_id', 'person_id']);
    table.index(['person_id'], 'family_event_attendees_person_idx');
  });

  await knex.schema.createTable('family_event_contributions', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('event_id').unsigned().notNullable();
    table.integer('contributor_person_id').unsigned().notNullable();
    table.foreign('event_id').references('family_events.id').onDelete('CASCADE');
    table.foreign('contributor_person_id').references('persons.id').onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.string('caption', 500).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.index(['event_id'], 'family_event_contributions_event_idx');
  });

  await knex.schema.createTable('family_event_photos', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('event_id').unsigned().notNullable();
    table.foreign('event_id').references('family_events.id').onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index(['event_id', 'sort_order'], 'family_event_photos_event_sort_idx');
  });

  await knex.schema.createTable('memoriam_tributes', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('deceased_person_id').unsigned().notNullable();
    table.integer('author_person_id').unsigned().notNullable();
    table.foreign('family_id').references('families.id').onDelete('CASCADE');
    table.foreign('deceased_person_id').references('persons.id').onDelete('CASCADE');
    table.foreign('author_person_id').references('persons.id').onDelete('CASCADE');
    table.text('content').notNullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();
    table.index(['family_id', 'deceased_person_id', 'deleted_at'], 'memoriam_tributes_lookup_idx');
  });

  await knex.schema.createTable('memoriam_tribute_photos', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('tribute_id').unsigned().notNullable();
    table.foreign('tribute_id').references('memoriam_tributes.id').onDelete('CASCADE');
    table.string('photo_url', 500).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index(['tribute_id', 'sort_order'], 'memoriam_tribute_photos_sort_idx');
  });

  await knex.schema.createTable('memoriam_prayers', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('deceased_person_id').unsigned().notNullable();
    table.integer('author_person_id').unsigned().notNullable();
    table.foreign('family_id').references('families.id').onDelete('CASCADE');
    table.foreign('deceased_person_id').references('persons.id').onDelete('CASCADE');
    table.foreign('author_person_id').references('persons.id').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.unique(['deceased_person_id', 'author_person_id'], {
      indexName: 'memoriam_prayers_deceased_author_unique',
    });
    table.index(['family_id', 'deceased_person_id'], 'memoriam_prayers_lookup_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('memoriam_prayers');
  await knex.schema.dropTableIfExists('memoriam_tribute_photos');
  await knex.schema.dropTableIfExists('memoriam_tributes');
  await knex.schema.dropTableIfExists('family_event_photos');
  await knex.schema.dropTableIfExists('family_event_contributions');
  await knex.schema.dropTableIfExists('family_event_attendees');
  await knex.schema.dropTableIfExists('family_event_persons');
  await knex.schema.dropTableIfExists('family_events');
}
