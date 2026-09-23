import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

const MODULE_ENUM = ['roots', 'core', 'money', 'household', 'biometric'] as const;
const MODULE_ENUM_DOWN = ['roots', 'core', 'money', 'household'] as const;

function enumSql(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN module_id ENUM(${enumSql(MODULE_ENUM)}) NOT NULL`,
    [Tables.MODULE_STATUSES],
  );

  await knex.schema.createTable(Tables.WEBAUTHN_CREDENTIALS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.string('label', 40).notNullable();
    table.boolean('enabled').notNullable().defaultTo(true);
    table.string('credential_id', 512).notNullable();
    table.specificType('public_key', 'blob').notNullable();
    table.bigInteger('counter').unsigned().notNullable().defaultTo(0);
    table.json('transports').nullable();
    table.timestamp('last_used_at').nullable();
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.unique(['credential_id'], 'core_webauthn_credentials_credential_id_uidx');
    table.index(['person_id'], 'core_webauthn_credentials_person_id_idx');
    table.index(['family_id'], 'core_webauthn_credentials_family_id_idx');
  });

  await knex.schema.createTable(Tables.WEBAUTHN_CHALLENGES, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('person_id').unsigned().nullable();
    table.enum('kind', ['login', 'register']).notNullable();
    table.string('challenge', 512).notNullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.unique(['challenge'], 'core_webauthn_challenges_challenge_uidx');
    table.index(['expires_at'], 'core_webauthn_challenges_expires_at_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.WEBAUTHN_CHALLENGES);
  await knex.schema.dropTableIfExists(Tables.WEBAUTHN_CREDENTIALS);

  await knex(Tables.MODULE_STATUSES).where({ module_id: 'biometric' }).delete();
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN module_id ENUM(${enumSql(MODULE_ENUM_DOWN)}) NOT NULL`,
    [Tables.MODULE_STATUSES],
  );
}
