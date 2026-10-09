import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Tempat kerja (workplaces) untuk task board (spec:
 * docs/requests/from-fe/pending/TASK-BOARD-WORKPLACES-API.md).
 *
 * - Tabel `tb_workplaces` (owner-scoped per `person_id`), bisa diarsipkan.
 * - Kolom `tb_tasks.workplace_id` (nullable, FK ON DELETE SET NULL).
 * - Backfill data lama: tiap pemilik yang punya task dibuatkan satu workplace
 *   default "Utama", lalu task yang `workplace_id`-nya NULL diisi ke situ.
 *   Idempotent: cek `is_default` dulu sebelum insert, jangan menimpa yang sudah ada.
 */
const EMPLOYMENT_TYPES = [
  'Fulltime',
  'Freelance',
  'Part-time',
  'Contract',
  'Personal',
] as const;

const DEFAULT_WORKPLACE_NAME = 'Utama';

export async function up(knex: Knex): Promise<void> {
  // Task board belum pernah naik → tidak ada task untuk di-backfill.
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  if (!(await knex.schema.hasTable(Tables.TB_WORKPLACES))) {
    await knex.schema.createTable(Tables.TB_WORKPLACES, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('person_id').unsigned().notNullable();
      table
        .foreign('person_id')
        .references(`${Tables.PERSONS}.id`)
        .onDelete('CASCADE');
      table.string('name', 120).notNullable();
      table.enum('employment_type', [...EMPLOYMENT_TYPES]).notNullable();
      table.string('role', 120).nullable();
      table.string('location', 160).nullable();
      table.string('accent', 24).nullable();
      table.date('started_at').nullable();
      table.date('ended_at').nullable();
      table.boolean('is_default').notNullable().defaultTo(false);
      table.timestamp('archived_at').nullable();
      table.timestamps(true, true);

      table.index(
        ['person_id', 'archived_at'],
        'tb_workplaces_person_archived_idx',
      );
      table.index(
        ['person_id', 'is_default'],
        'tb_workplaces_person_default_idx',
      );
    });
  }

  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'workplace_id'))) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.integer('workplace_id').unsigned().nullable();
      table
        .foreign('workplace_id')
        .references(`${Tables.TB_WORKPLACES}.id`)
        .onDelete('SET NULL');
      table.index(['workplace_id'], 'tb_tasks_workplace_idx');
    });
  }

  await backfillDefaultWorkplace(knex);
}

async function backfillDefaultWorkplace(knex: Knex): Promise<void> {
  const persons = await knex(Tables.TB_TASKS)
    .distinct<Array<{ person_id: number }>>('person_id');

  for (const { person_id } of persons) {
    const existing = await knex(Tables.TB_WORKPLACES)
      .where({ person_id, is_default: true })
      .first<{ id: number }>('id');

    let workplaceId = existing?.id;

    if (workplaceId === undefined) {
      const [insertedId] = await knex(Tables.TB_WORKPLACES).insert({
        person_id,
        name: DEFAULT_WORKPLACE_NAME,
        employment_type: 'Fulltime',
        is_default: true,
      });
      workplaceId = insertedId as number;
    }

    await knex(Tables.TB_TASKS)
      .where({ person_id })
      .whereNull('workplace_id')
      .update({ workplace_id: workplaceId });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  if (await knex.schema.hasColumn(Tables.TB_TASKS, 'workplace_id')) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropForeign('workplace_id');
    });
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropIndex(['workplace_id'], 'tb_tasks_workplace_idx');
    });
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropColumn('workplace_id');
    });
  }

  await knex.schema.dropTableIfExists(Tables.TB_WORKPLACES);
}
