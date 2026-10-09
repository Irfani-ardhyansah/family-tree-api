import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Urutan manual list task (spec:
 * docs/requests/from-fe/pending/TASK-BOARD-ORDERING-API.md).
 *
 * - `tb_tasks.sort_order` (integer, 0 = paling atas), di-scope per pemilik.
 * - Backfill: urutkan task lama per `person_id` berdasarkan
 *   `updated_at DESC, id DESC` (urutan tampil saat ini) → `sort_order = 0..n-1`.
 * - Idempotent: aman dijalankan ulang & kalau task board belum pernah naik.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'sort_order'))) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.integer('sort_order').notNullable().defaultTo(0);
      table.index(['person_id', 'sort_order'], 'tb_tasks_person_sort_idx');
    });
  }

  await backfillTaskOrder(knex);
}

async function backfillTaskOrder(knex: Knex): Promise<void> {
  const persons = await knex(Tables.TB_TASKS)
    .distinct<Array<{ person_id: number }>>('person_id');

  for (const { person_id } of persons) {
    const rows = await knex(Tables.TB_TASKS)
      .where({ person_id })
      .orderBy('updated_at', 'desc')
      .orderBy('id', 'desc')
      .select<Array<{ id: number }>>('id');

    for (let index = 0; index < rows.length; index += 1) {
      await knex(Tables.TB_TASKS)
        .where({ id: rows[index].id })
        .update({ sort_order: index });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;
  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'sort_order'))) return;

  await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
    table.dropIndex(['person_id', 'sort_order'], 'tb_tasks_person_sort_idx');
  });
  await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
    table.dropColumn('sort_order');
  });
}
