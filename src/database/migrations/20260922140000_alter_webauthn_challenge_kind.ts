import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN kind ENUM('login', 'register', 'unlock') NOT NULL`,
    [Tables.WEBAUTHN_CHALLENGES],
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex(Tables.WEBAUTHN_CHALLENGES).where({ kind: 'unlock' }).delete();
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN kind ENUM('login', 'register') NOT NULL`,
    [Tables.WEBAUTHN_CHALLENGES],
  );
}
