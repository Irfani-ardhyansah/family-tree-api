import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/** ENUM `core_module_statuses.module_id` setelah task-board didaftarkan. */
const MODULE_ENUM = [
  'roots',
  'core',
  'money',
  'household',
  'biometric',
  'task-board',
] as const;

const MODULE_ENUM_DOWN = [
  'roots',
  'core',
  'money',
  'household',
  'biometric',
] as const;

function enumSql(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

/** Helper sama seperti di 20260815100000_create_family_core.ts: ALTER hanya kalau nilai belum ada. */
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

/**
 * Tambah 'task-board' ke ENUM module_id supaya modul baru bisa di-toggle
 * dari panel admin tanpa seeder (row-nya dibuat otomatis saat toggle/list).
 */
export async function up(knex: Knex): Promise<void> {
  if (await enumHasValue(knex, Tables.MODULE_STATUSES, 'module_id', 'task-board')) {
    return;
  }

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN module_id ENUM(${enumSql(MODULE_ENUM)}) NOT NULL`,
    [Tables.MODULE_STATUSES],
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex(Tables.MODULE_STATUSES).where({ module_id: 'task-board' }).delete();

  if (!(await enumHasValue(knex, Tables.MODULE_STATUSES, 'module_id', 'task-board'))) {
    return;
  }

  await knex.raw(
    `ALTER TABLE ?? MODIFY COLUMN module_id ENUM(${enumSql(MODULE_ENUM_DOWN)}) NOT NULL`,
    [Tables.MODULE_STATUSES],
  );
}
