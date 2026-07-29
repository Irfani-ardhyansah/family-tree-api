import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

const PURPOSE_ENUM = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
  'money_transaction',
  'money_cash_withdrawal',
  'money_wishlist',
] as const;

const PURPOSE_ENUM_DOWN = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
] as const;

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN purpose ENUM(${PURPOSE_ENUM.map((v) => `'${v}'`).join(', ')}) NOT NULL`,
    [Tables.MEDIA],
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex(Tables.MEDIA)
    .whereIn('purpose', [
      'money_transaction',
      'money_cash_withdrawal',
      'money_wishlist',
    ])
    .update({ purpose: 'event' });

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN purpose ENUM(${PURPOSE_ENUM_DOWN.map((v) => `'${v}'`).join(', ')}) NOT NULL`,
    [Tables.MEDIA],
  );
}
