import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Task Board — riwayat aktivitas, bukan cuma status.
 * Spec: docs/requests/to-fe/pending/TASK-BOARD-ACTIVITY-HISTORY-FE-PROMPT.md
 *
 * - `tb_task_history.action` — jenis aksi: `created`, `status_changed`,
 *   `description_added`, `description_updated`, `description_removed`,
 *   `revision_created`.
 * - `tb_task_history.related_task_id` — task terkait. Untuk `revision_created`
 *   (entri di history task INDUK) berisi id task anak/revisi, supaya FE bisa
 *   menautkannya ke detail child. FK `ON DELETE SET NULL`: task anak dihapus →
 *   entri tetap ada, link-nya dilepas.
 *
 * Backfill: baris lama di-set `status_changed`, lalu entri terawal tiap task
 * (entri pembuatan) di-set `created`. Idempotent — aman dijalankan ulang.
 */

export async function up(knex: Knex): Promise<void> {
  // Task board belum pernah naik di database ini → tidak ada yang diubah.
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;
  if (!(await knex.schema.hasTable(Tables.TB_TASK_HISTORY))) return;

  if (!(await knex.schema.hasColumn(Tables.TB_TASK_HISTORY, 'action'))) {
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.string('action', 50).notNullable().defaultTo('status_changed');
      table.index(['action'], 'tb_task_history_action_idx');
    });
  }

  if (!(await knex.schema.hasColumn(Tables.TB_TASK_HISTORY, 'related_task_id'))) {
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.integer('related_task_id').unsigned().nullable();
      table.foreign('related_task_id').references(`${Tables.TB_TASKS}.id`).onDelete('SET NULL');
      table.index(['related_task_id'], 'tb_task_history_related_idx');
    });
  }

  await backfillAction(knex);
}

/** Entri terawal tiap task = entri pembuatan → `created`. Sisanya `status_changed` (default). */
async function backfillAction(knex: Knex): Promise<void> {
  const rows = await knex(Tables.TB_TASK_HISTORY)
    .orderBy('id', 'asc')
    .select<Array<{ id: number; task_id: number }>>('id', 'task_id');

  const seenTasks = new Set<number>();
  const firstEntryIds: number[] = [];

  for (const row of rows) {
    if (seenTasks.has(row.task_id)) continue;
    seenTasks.add(row.task_id);
    firstEntryIds.push(row.id);
  }

  for (let i = 0; i < firstEntryIds.length; i += 500) {
    await knex(Tables.TB_TASK_HISTORY)
      .whereIn('id', firstEntryIds.slice(i, i + 500))
      .where('action', '!=', 'created')
      .update({ action: 'created' });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASK_HISTORY))) return;

  if (await knex.schema.hasColumn(Tables.TB_TASK_HISTORY, 'related_task_id')) {
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.dropForeign(['related_task_id']);
    });
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.dropIndex(['related_task_id'], 'tb_task_history_related_idx');
    });
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.dropColumn('related_task_id');
    });
  }

  if (await knex.schema.hasColumn(Tables.TB_TASK_HISTORY, 'action')) {
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.dropIndex(['action'], 'tb_task_history_action_idx');
    });
    await knex.schema.alterTable(Tables.TB_TASK_HISTORY, (table) => {
      table.dropColumn('action');
    });
  }
}
