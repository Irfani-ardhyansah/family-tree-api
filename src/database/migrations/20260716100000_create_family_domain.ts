import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Core + Family Roots domain schema.
 * Prefixes: core_ (shared/auth), fr_ (Family Roots).
 *
 * See docs/reference/DATABASE-DESIGN.md
 */
export async function up(knex: Knex): Promise<void> {
  // Legacy / unprefixed leftovers from earlier iterations
  await knex.schema.dropTableIfExists('family_trees');
  await knex.schema.dropTableIfExists('user_profiles');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('person_spouses');
  await knex.schema.dropTableIfExists('person_addresses');
  await knex.schema.dropTableIfExists('person_details');
  await knex.schema.dropTableIfExists('family_members');
  await knex.schema.dropTableIfExists('persons');
  await knex.schema.dropTableIfExists('families');
  await knex.schema.dropTableIfExists(Tables.PERSON_SPOUSES);
  await knex.schema.dropTableIfExists(Tables.PERSON_ADDRESSES);
  await knex.schema.dropTableIfExists(Tables.PERSON_LINEAGE);
  await knex.schema.dropTableIfExists(Tables.FAMILY_MEMBERS);
  await knex.schema.dropTableIfExists(Tables.PERSON_DETAILS);
  await knex.schema.dropTableIfExists(Tables.PERSONS);
  await knex.schema.dropTableIfExists(Tables.FAMILIES);

  await knex.schema.createTable(Tables.FAMILIES, (table) => {
    table.increments('id').unsigned().primary();
    table.string('name', 255).notNullable();
    table.integer('root_person_id').unsigned().nullable();
    table.timestamps(true, true);
  });

  await knex.schema.createTable(Tables.PERSONS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');

    table.string('full_name', 255).notNullable();
    table.string('nickname', 255).nullable();
    table.enum('gender', ['male', 'female']).notNullable();
    table.date('birth_date').notNullable();
    table.date('death_date').nullable();
    table.enum('status', ['alive', 'deceased']).notNullable().defaultTo('alive');
    table.timestamp('deleted_at').nullable();

    table.timestamps(true, true);

    table.index(['family_id'], 'core_persons_family_id_idx');
    table.index(['family_id', 'status'], 'core_persons_family_status_idx');
    table.index(['family_id', 'deleted_at'], 'core_persons_family_deleted_idx');
    table.index(['birth_date'], 'core_persons_birth_date_idx');
    table.index(['full_name'], 'core_persons_full_name_idx');
  });

  await knex.schema.alterTable(Tables.FAMILIES, (table) => {
    table.foreign('root_person_id').references(`${Tables.PERSONS}.id`).onDelete('SET NULL');
  });

  await knex.schema.createTable(Tables.PERSON_DETAILS, (table) => {
    table.integer('person_id').unsigned().primary();
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');

    table.enum('religion', ['islam', 'other']).nullable();
    table.string('photo_url', 512).nullable();
    table.string('occupation', 255).nullable();
    table.string('phone', 64).nullable();
    table.string('phone_alt', 64).nullable();

    table.timestamps(true, true);
  });

  await knex.schema.createTable(Tables.FAMILY_MEMBERS, (table) => {
    table.integer('family_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.enum('role', ['admin', 'member']).notNullable().defaultTo('member');
    table.timestamps(true, true);

    table.primary(['family_id', 'person_id']);
    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.index(['person_id'], 'core_family_members_person_id_idx');
  });

  // Family Roots — silsilah edges (ayah/ibu)
  await knex.schema.createTable(Tables.PERSON_LINEAGE, (table) => {
    table.integer('person_id').unsigned().primary();
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');

    table.integer('father_id').unsigned().nullable();
    table.integer('mother_id').unsigned().nullable();
    table.timestamps(true, true);

    table.foreign('father_id').references(`${Tables.PERSONS}.id`).onDelete('SET NULL');
    table.foreign('mother_id').references(`${Tables.PERSONS}.id`).onDelete('SET NULL');
    table.index(['father_id'], 'fr_person_lineage_father_id_idx');
    table.index(['mother_id'], 'fr_person_lineage_mother_id_idx');
  });

  await knex.schema.createTable(Tables.PERSON_ADDRESSES, (table) => {
    table.integer('person_id').unsigned().primary();
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');

    table.string('street', 255).nullable();
    table.string('district', 128).nullable();
    table.string('city', 128).nullable();
    table.string('province', 128).nullable();
    table.string('postal_code', 16).nullable();
    table.string('country', 64).nullable();
    table.decimal('latitude', 10, 7).nullable();
    table.decimal('longitude', 10, 7).nullable();

    table.timestamps(true, true);
    table.index(['city'], 'fr_person_addresses_city_idx');
  });

  await knex.schema.createTable(Tables.PERSON_SPOUSES, (table) => {
    table.integer('person_id_a').unsigned().notNullable();
    table.integer('person_id_b').unsigned().notNullable();
    table.timestamps(true, true);

    table.primary(['person_id_a', 'person_id_b']);
    table.foreign('person_id_a').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.foreign('person_id_b').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.index(['person_id_b'], 'fr_person_spouses_person_id_b_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.PERSON_SPOUSES);
  await knex.schema.dropTableIfExists(Tables.PERSON_ADDRESSES);
  await knex.schema.dropTableIfExists(Tables.PERSON_LINEAGE);
  await knex.schema.dropTableIfExists(Tables.FAMILY_MEMBERS);
  await knex.schema.dropTableIfExists(Tables.PERSON_DETAILS);

  const hasFamilies = await knex.schema.hasTable(Tables.FAMILIES);
  if (hasFamilies) {
    await knex.schema.alterTable(Tables.FAMILIES, (table) => {
      table.dropForeign(['root_person_id']);
    });
  }

  await knex.schema.dropTableIfExists(Tables.PERSONS);
  await knex.schema.dropTableIfExists(Tables.FAMILIES);
}
