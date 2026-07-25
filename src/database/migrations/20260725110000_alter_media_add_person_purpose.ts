import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    ALTER TABLE media
    MODIFY COLUMN purpose ENUM('event', 'event_contribution', 'memoriam_tribute', 'person') NOT NULL
  `);
  await knex.raw(`
    ALTER TABLE media
    MODIFY COLUMN attached_to_type ENUM('event', 'event_contribution', 'tribute', 'person') NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex('media').where({ purpose: 'person' }).del();
  await knex('media').where({ attached_to_type: 'person' }).update({ attached_to_type: null });

  await knex.raw(`
    ALTER TABLE media
    MODIFY COLUMN purpose ENUM('event', 'event_contribution', 'memoriam_tribute') NOT NULL
  `);
  await knex.raw(`
    ALTER TABLE media
    MODIFY COLUMN attached_to_type ENUM('event', 'event_contribution', 'tribute') NULL
  `);
}
