import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('person_import_jobs', (table) => {
    table.string('id', 40).primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references('families.id').onDelete('CASCADE');
    table.integer('created_by_person_id').unsigned().notNullable();
    table.foreign('created_by_person_id').references('persons.id').onDelete('CASCADE');

    table.boolean('dry_run').notNullable().defaultTo(false);
    table.enum('format', ['csv', 'json']).notNullable();
    table
      .enum('status', ['queued', 'validating', 'importing', 'completed', 'failed'])
      .notNullable()
      .defaultTo('queued');

    table.integer('progress_percent').unsigned().notNullable().defaultTo(0);
    table.integer('processed').unsigned().notNullable().defaultTo(0);
    table.integer('total').unsigned().notNullable().defaultTo(0);
    table.string('message', 500).nullable();

    table.json('payload').notNullable();
    table.json('errors').nullable();
    table.json('result').nullable();

    table.timestamps(true, true);
    table.timestamp('started_at').nullable();
    table.timestamp('finished_at').nullable();

    table.index(['family_id', 'created_at'], 'person_import_jobs_family_created_idx');
    table.index(['status', 'created_at'], 'person_import_jobs_status_created_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('person_import_jobs');
}
