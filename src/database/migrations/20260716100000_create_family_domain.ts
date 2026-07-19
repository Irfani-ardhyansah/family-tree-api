import type { Knex } from 'knex';

/**
 * FamilyRoots domain schema (v4).
 * All primary/foreign keys use unsigned integers (auto-increment).
 *
 * See docs/DATABASE-DESIGN.md
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('family_trees');
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('person_spouses');
  await knex.schema.dropTableIfExists('person_addresses');
  await knex.schema.dropTableIfExists('person_details');
  await knex.schema.dropTableIfExists('family_members');
  await knex.schema.dropTableIfExists('persons');
  await knex.schema.dropTableIfExists('families');

  await knex.schema.createTable('families', (table) => {
    table.increments('id').unsigned().primary();
    table.string('name', 255).notNullable();
    table.integer('root_person_id').unsigned().nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable('persons', (table) => {
    table.increments('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references('families.id').onDelete('CASCADE');

    table.string('full_name', 255).notNullable();
    table.string('nickname', 255).nullable();
    table.enum('gender', ['male', 'female']).notNullable();
    table.date('birth_date').notNullable();
    table.date('death_date').nullable();
    table.enum('status', ['alive', 'deceased']).notNullable().defaultTo('alive');

    table.integer('father_id').unsigned().nullable();
    table.integer('mother_id').unsigned().nullable();
    table.timestamp('deleted_at').nullable();

    table.timestamps(true, true);

    table.index(['family_id'], 'persons_family_id_idx');
    table.index(['family_id', 'status'], 'persons_family_status_idx');
    table.index(['family_id', 'deleted_at'], 'persons_family_deleted_idx');
    table.index(['birth_date'], 'persons_birth_date_idx');
    table.index(['full_name'], 'persons_full_name_idx');
    table.index(['father_id'], 'persons_father_id_idx');
    table.index(['mother_id'], 'persons_mother_id_idx');
  });

  await knex.schema.alterTable('persons', (table) => {
    table.foreign('father_id').references('persons.id').onDelete('SET NULL');
    table.foreign('mother_id').references('persons.id').onDelete('SET NULL');
  });

  await knex.schema.alterTable('families', (table) => {
    table.foreign('root_person_id').references('persons.id').onDelete('SET NULL');
  });

  await knex.schema.createTable('person_details', (table) => {
    table.integer('person_id').unsigned().primary();
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');

    table.enum('religion', ['islam', 'other']).nullable();
    table.string('photo_url', 512).nullable();
    table.string('occupation', 255).nullable();
    table.string('phone', 64).nullable();
    table.string('phone_alt', 64).nullable();

    table.timestamps(true, true);
  });

  await knex.schema.createTable('family_members', (table) => {
    table.integer('family_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.enum('role', ['admin', 'member']).notNullable().defaultTo('member');
    table.timestamps(true, true);

    table.primary(['family_id', 'person_id']);
    table.foreign('family_id').references('families.id').onDelete('CASCADE');
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');
    table.index(['person_id'], 'family_members_person_id_idx');
  });

  await knex.schema.createTable('person_addresses', (table) => {
    table.integer('person_id').unsigned().primary();
    table.foreign('person_id').references('persons.id').onDelete('CASCADE');

    table.string('street', 255).nullable();
    table.string('district', 128).nullable();
    table.string('city', 128).nullable();
    table.string('province', 128).nullable();
    table.string('postal_code', 16).nullable();
    table.string('country', 64).nullable();
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();

    table.timestamps(true, true);
    table.index(['city'], 'person_addresses_city_idx');
  });

  await knex.schema.createTable('person_spouses', (table) => {
    table.integer('person_id_a').unsigned().notNullable();
    table.integer('person_id_b').unsigned().notNullable();
    table.timestamps(true, true);

    table.primary(['person_id_a', 'person_id_b']);
    table.foreign('person_id_a').references('persons.id').onDelete('CASCADE');
    table.foreign('person_id_b').references('persons.id').onDelete('CASCADE');
    table.index(['person_id_b'], 'person_spouses_person_id_b_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('person_spouses');
  await knex.schema.dropTableIfExists('person_addresses');
  await knex.schema.dropTableIfExists('family_members');
  await knex.schema.dropTableIfExists('person_details');

  await knex.schema.alterTable('families', (table) => {
    table.dropForeign(['root_person_id']);
  });

  await knex.schema.alterTable('persons', (table) => {
    table.dropForeign(['father_id']);
    table.dropForeign(['mother_id']);
  });

  await knex.schema.dropTableIfExists('persons');
  await knex.schema.dropTableIfExists('families');
}
