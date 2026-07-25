import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('person_options', (table) => {
    table.integer('person_id').unsigned().notNullable();
    table.string('setting', 64).notNullable();
    table.string('value', 512).notNullable();
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.primary(['person_id', 'setting']);
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');
    table.index(['setting'], 'person_options_setting_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('person_options');
}
