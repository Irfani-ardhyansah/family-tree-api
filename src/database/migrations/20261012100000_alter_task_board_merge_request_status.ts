import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Task Board — status baru "Merge Request" (spec:
 * docs/requests/from-fe/pending/TASK-BOARD-MERGE-REQUEST-STATUS-BE-PROMPT.md).
 *
 * Alur status jadi: To-Do → In Progress → Merge Request → Merged.
 * "Merge Request" = MR sudah dibuka tapi belum di-merge.
 *
 * Tidak ada perubahan data: semua baris lama tetap valid. Idempotent —
 * guard `enumHasValue` bikin aman kalau dijalankan ulang, dan `hasTable`
 * bikin aman kalau task board belum pernah naik di database ini.
 */

const TASK_STATUS_ENUM = ['To-Do', 'In Progress', 'Merge Request', 'Merged'] as const;
const TASK_STATUS_ENUM_DOWN = ['To-Do', 'In Progress', 'Merged'] as const;

function enumSql(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

/** Helper sama seperti di 20260929100000_alter_task_board_enhancements.ts. */
async function enumHasValue(
  knex: Knex,
  table: string,
  column: string,
  value: string,
): Promise<boolean> {
  const rows = await knex.raw<
    | { rows?: Array<{ Type?: string; type?: string }> }
    | Array<{ Type?: string; type?: string }>
  >(`SHOW COLUMNS FROM ?? LIKE ?`, [table, column]);
  const list = Array.isArray(rows) ? rows[0] : (rows as { rows?: unknown }).rows;
  const col = Array.isArray(list) ? list[0] : undefined;
  const typeStr = String(col?.Type ?? col?.type ?? '');
  return typeStr.includes(`'${value}'`);
}

export async function up(knex: Knex): Promise<void> {
  // Task board belum pernah naik di database ini → tidak ada yang diubah.
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  if (await enumHasValue(knex, Tables.TB_TASKS, 'status', 'Merge Request')) return;

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN status ENUM(${enumSql(TASK_STATUS_ENUM)}) NOT NULL`,
    [Tables.TB_TASKS],
  );
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;
  if (!(await enumHasValue(knex, Tables.TB_TASKS, 'status', 'Merge Request'))) return;

  // Baris "Merge Request" dilebur ke "In Progress" sebelum ENUM-nya dipersempit.
  await knex(Tables.TB_TASKS).where({ status: 'Merge Request' }).update({ status: 'In Progress' });

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN status ENUM(${enumSql(TASK_STATUS_ENUM_DOWN)}) NOT NULL`,
    [Tables.TB_TASKS],
  );
}
