import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

const MEDIA_PURPOSE_ENUM = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
  'money_transaction',
  'money_cash_withdrawal',
  'money_wishlist',
  'fc_document',
] as const;

const MEDIA_PURPOSE_ENUM_DOWN = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
  'money_transaction',
  'money_cash_withdrawal',
  'money_wishlist',
] as const;

const MEDIA_ATTACHED_ENUM = [
  'event',
  'event_contribution',
  'tribute',
  'person',
  'fc_document',
] as const;

const MEDIA_ATTACHED_ENUM_DOWN = [
  'event',
  'event_contribution',
  'tribute',
  'person',
] as const;

async function enumHasValue(
  knex: Knex,
  table: string,
  column: string,
  value: string,
): Promise<boolean> {
  const rows = await knex.raw<{ rows?: Array<{ Type?: string; type?: string }> } | Array<{ Type?: string; type?: string }>>(
    `SHOW COLUMNS FROM ?? LIKE ?`,
    [table, column],
  );
  const list = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown }).rows;
  const col = Array.isArray(list) ? list[0] : undefined;
  const typeStr = String(col?.Type ?? col?.type ?? '');
  return typeStr.includes(`'${value}'`);
}

/**
 * Additive only: creates fc_* tables and extends media enums.
 * Idempotent (safe if tables already exist from a partial previous run).
 * Does not modify or delete mt_* / existing rows.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.FC_DOCUMENT_TYPES))) {
    await knex.schema.createTable(Tables.FC_DOCUMENT_TYPES, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('family_id').unsigned().notNullable();
      table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
      table.string('slug', 80).notNullable();
      table.string('label', 120).notNullable();
      table.string('icon_key', 40).notNullable();
      table.string('tone_key', 40).notNullable();
      table.json('extras').notNullable();
      table.boolean('default_lifetime').notNullable().defaultTo(false);
      table.boolean('allow_custom_title').notNullable().defaultTo(false);
      table.boolean('is_system').notNullable().defaultTo(false);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.unique(['family_id', 'slug'], 'fc_document_types_family_slug_uidx');
      table.index(['family_id', 'sort_order'], 'fc_document_types_family_sort_idx');
    });
  }

  if (!(await knex.schema.hasTable(Tables.FC_CALENDAR_EVENT_TYPES))) {
    await knex.schema.createTable(Tables.FC_CALENDAR_EVENT_TYPES, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('family_id').unsigned().notNullable();
      table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
      table.string('slug', 80).notNullable();
      table.string('label', 120).notNullable();
      table.string('icon_key', 40).notNullable();
      table.string('tone_key', 40).notNullable();
      table.boolean('links_to_health').notNullable().defaultTo(false);
      table.boolean('is_system').notNullable().defaultTo(false);
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.unique(['family_id', 'slug'], 'fc_calendar_event_types_family_slug_uidx');
      table.index(['family_id', 'sort_order'], 'fc_calendar_event_types_family_sort_idx');
    });
  }

  if (!(await knex.schema.hasTable(Tables.FC_DOCUMENTS))) {
    await knex.schema.createTable(Tables.FC_DOCUMENTS, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('family_id').unsigned().notNullable();
      table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
      table.integer('person_id').unsigned().notNullable();
      table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
      table.string('document_type_slug', 80).notNullable();
      table.string('custom_title', 160).nullable();
      table.text('document_number_cipher').notNullable();
      table.string('document_number_iv', 64).notNullable();
      table.date('issued_at').nullable();
      table.date('expires_at').nullable();
      table.boolean('is_lifetime').notNullable().defaultTo(false);
      table.text('notes').nullable();
      table.json('extras').notNullable();
      table.boolean('reminder_enabled').notNullable().defaultTo(false);
      table.integer('reminder_days').unsigned().nullable();
      table.integer('created_by_person_id').unsigned().notNullable();
      table.foreign('created_by_person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['family_id', 'person_id'], 'fc_documents_family_person_idx');
      table.index(['family_id', 'document_type_slug'], 'fc_documents_family_type_idx');
      table.index(['family_id', 'expires_at'], 'fc_documents_family_expires_idx');
    });
  }

  if (!(await knex.schema.hasTable(Tables.FC_DOCUMENT_FILES))) {
    await knex.schema.createTable(Tables.FC_DOCUMENT_FILES, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('document_id').unsigned().notNullable();
      table.foreign('document_id').references(`${Tables.FC_DOCUMENTS}.id`).onDelete('CASCADE');
      table.string('media_id', 40).notNullable();
      table.foreign('media_id').references(`${Tables.MEDIA}.id`).onDelete('CASCADE');
      table.integer('sort_order').notNullable().defaultTo(0);
      table.timestamps(true, true);

      table.unique(['document_id', 'media_id'], 'fc_document_files_doc_media_uidx');
      table.index(['document_id', 'sort_order'], 'fc_document_files_doc_sort_idx');
    });
  }

  if (!(await enumHasValue(knex, Tables.MEDIA, 'purpose', 'fc_document'))) {
    await knex.raw(
      `ALTER TABLE ?? MODIFY COLUMN purpose ENUM(${MEDIA_PURPOSE_ENUM.map((v) => `'${v}'`).join(', ')}) NOT NULL`,
      [Tables.MEDIA],
    );
  }

  if (!(await enumHasValue(knex, Tables.MEDIA, 'attached_to_type', 'fc_document'))) {
    await knex.raw(
      `ALTER TABLE ?? MODIFY COLUMN attached_to_type ENUM(${MEDIA_ATTACHED_ENUM.map((v) => `'${v}'`).join(', ')}) NULL`,
      [Tables.MEDIA],
    );
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.FC_DOCUMENT_FILES);
  await knex.schema.dropTableIfExists(Tables.FC_DOCUMENTS);
  await knex.schema.dropTableIfExists(Tables.FC_CALENDAR_EVENT_TYPES);
  await knex.schema.dropTableIfExists(Tables.FC_DOCUMENT_TYPES);

  await knex(Tables.MEDIA).where({ purpose: 'fc_document' }).update({ purpose: 'person' });
  await knex(Tables.MEDIA)
    .where({ attached_to_type: 'fc_document' })
    .update({ attached_to_type: 'person' });

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN purpose ENUM(${MEDIA_PURPOSE_ENUM_DOWN.map((v) => `'${v}'`).join(', ')}) NOT NULL`,
    [Tables.MEDIA],
  );
  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN attached_to_type ENUM(${MEDIA_ATTACHED_ENUM_DOWN.map((v) => `'${v}'`).join(', ')}) NULL`,
    [Tables.MEDIA],
  );
}
