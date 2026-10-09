import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Urutan manual penjelasan (descriptions) & todo per task (spec:
 * docs/requests/from-fe/pending/TASK-BOARD-ITEM-ORDERING-API.md).
 *
 * - `tb_task_descriptions.sort_order` + index `(task_id, sort_order)`.
 * - `tb_task_todos.sort_order` + index `(task_id, sort_order)`.
 * - Backfill: urutkan entri lama per parent berdasarkan `created_at ASC, id ASC`
 *   (urutan tampil saat ini) → `sort_order = 0..n-1`.
 * - Idempotent: aman dijalankan ulang & kalau tabel belum ada.
 */
export async function up(knex: Knex): Promise<void> {
  await addSortOrder(knex, Tables.TB_TASK_DESCRIPTIONS, 'tb_task_descriptions_task_sort_idx');
  await addSortOrder(knex, Tables.TB_TASK_TODOS, 'tb_task_todos_task_sort_idx');
}

async function addSortOrder(
  knex: Knex,
  tableName: string,
  indexName: string,
): Promise<void> {
  if (!(await knex.schema.hasTable(tableName))) return;
  if (await knex.schema.hasColumn(tableName, 'sort_order')) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.integer('sort_order').notNullable().defaultTo(0);
    table.index(['task_id', 'sort_order'], indexName);
  });

  const tasks = await knex(tableName)
    .distinct<Array<{ task_id: number }>>('task_id');

  for (const { task_id } of tasks) {
    const rows = await knex(tableName)
      .where({ task_id })
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .select<Array<{ id: number }>>('id');

    for (let index = 0; index < rows.length; index += 1) {
      await knex(tableName)
        .where({ id: rows[index].id })
        .update({ sort_order: index });
    }
  }
}

async function dropSortOrder(
  knex: Knex,
  tableName: string,
  indexName: string,
): Promise<void> {
  if (!(await knex.schema.hasTable(tableName))) return;
  if (!(await knex.schema.hasColumn(tableName, 'sort_order'))) return;

  await knex.schema.alterTable(tableName, (table) => {
    table.dropIndex(['task_id', 'sort_order'], indexName);
  });
  await knex.schema.alterTable(tableName, (table) => {
    table.dropColumn('sort_order');
  });
}

export async function down(knex: Knex): Promise<void> {
  await dropSortOrder(knex, Tables.TB_TASK_DESCRIPTIONS, 'tb_task_descriptions_task_sort_idx');
  await dropSortOrder(knex, Tables.TB_TASK_TODOS, 'tb_task_todos_task_sort_idx');
}
