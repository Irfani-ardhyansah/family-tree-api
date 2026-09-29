import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Task Board enhancement (spec: docs/requests/from-fe/done/TASK-BOARD-enhancements.md).
 *
 * - `tb_tasks.status`: buang nilai "Done" (status terakhir = "Merged").
 * - `tb_tasks.parent_task_id`: relasi revisi (parent → anak).
 * - `tb_tasks.migration_files`: JSON array nama file migration.
 * - `tb_task_descriptions`: banyak deskripsi per task (title + content).
 * - `tb_task_history`: riwayat perubahan status + notes.
 *
 * Data lama ikut dipindah: `description` → satu baris `tb_task_descriptions`
 * (judul "Deskripsi"), status "Done" → "Merged", dan satu baris history awal
 * per task sesuai status terakhir. Idempotent: aman kalau dijalankan ulang.
 */

const TASK_STATUS_ENUM = ['To-Do', 'In Progress', 'Merged'] as const;
const TASK_STATUS_ENUM_DOWN = ['To-Do', 'In Progress', 'Merged', 'Done'] as const;

/** Judul entri deskripsi hasil konversi kolom lama `tb_tasks.description`. */
const LEGACY_DESCRIPTION_TITLE = 'Deskripsi';

function enumSql(values: readonly string[]): string {
  return values.map((value) => `'${value}'`).join(', ');
}

/** Helper sama seperti di 20260928100000_alter_module_statuses_add_task_board.ts. */
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

async function createDescriptionsTable(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(Tables.TB_TASK_DESCRIPTIONS)) return;

  await knex.schema.createTable(Tables.TB_TASK_DESCRIPTIONS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('task_id').unsigned().notNullable();
    table.foreign('task_id').references(`${Tables.TB_TASKS}.id`).onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('content').notNullable();
    table.timestamps(true, true);

    table.index(['task_id'], 'tb_task_descriptions_task_idx');
  });
}

async function createHistoryTable(knex: Knex): Promise<void> {
  if (await knex.schema.hasTable(Tables.TB_TASK_HISTORY)) return;

  await knex.schema.createTable(Tables.TB_TASK_HISTORY, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('task_id').unsigned().notNullable();
    table.foreign('task_id').references(`${Tables.TB_TASKS}.id`).onDelete('CASCADE');
    table.string('status', 50).notNullable();
    table.text('notes').nullable();
    table.timestamp('changed_at').notNullable().defaultTo(knex.fn.now());

    table.index(['task_id'], 'tb_task_history_task_idx');
    table.index(['changed_at'], 'tb_task_history_changed_idx');
  });
}


export async function up(knex: Knex): Promise<void> {
  // Task board belum pernah naik di database ini → tidak ada yang diubah.
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'parent_task_id'))) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.integer('parent_task_id').unsigned().nullable();
      table.foreign('parent_task_id').references(`${Tables.TB_TASKS}.id`).onDelete('SET NULL');
      table.index(['parent_task_id'], 'tb_tasks_parent_idx');
    });
  }

  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'migration_files'))) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.json('migration_files').nullable();
    });
  }

  await createDescriptionsTable(knex);
  await createHistoryTable(knex);

  // Status "Done" dibuang: baris lama dilebur ke "Merged" sebelum ENUM-nya dipersempit.
  if (await enumHasValue(knex, Tables.TB_TASKS, 'status', 'Done')) {
    await knex(Tables.TB_TASKS).where({ status: 'Done' }).update({ status: 'Merged' });

    await knex.raw(
      `ALTER TABLE ?? MODIFY COLUMN status ENUM(${enumSql(TASK_STATUS_ENUM)}) NOT NULL`,
      [Tables.TB_TASKS],
    );
  }

  await migrateLegacyDescriptions(knex);
  await migrateLegacyMigrationFiles(knex);
  await backfillHistory(knex);
}

/** Kolom lama `description` → satu baris `tb_task_descriptions`, lalu kolomnya dibuang. */
async function migrateLegacyDescriptions(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'description'))) return;

  const legacyTasks = await knex(Tables.TB_TASKS)
    .whereNotNull('description')
    .whereNot('description', '')
    .select<Array<{ id: number; description: string }>>('id', 'description');

  if (legacyTasks.length > 0) {
    const existing = await knex(Tables.TB_TASK_DESCRIPTIONS)
      .whereIn('task_id', legacyTasks.map((task) => task.id))
      .select<Array<{ task_id: number }>>('task_id');
    const alreadyMigrated = new Set(existing.map((row) => row.task_id));

    const rows = legacyTasks
      .filter((task) => !alreadyMigrated.has(task.id))
      .map((task) => ({
        task_id: task.id,
        title: LEGACY_DESCRIPTION_TITLE,
        content: task.description,
      }));

    if (rows.length > 0) {
      await knex(Tables.TB_TASK_DESCRIPTIONS).insert(rows);
    }
  }

  await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
    table.dropColumn('description');
  });
}

/** Kolom `migration_file` (kalau ada di database lama) → array JSON `migration_files`. */
async function migrateLegacyMigrationFiles(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'migration_file'))) return;

  const legacyTasks = await knex(Tables.TB_TASKS)
    .whereNotNull('migration_file')
    .whereNot('migration_file', '')
    .select<Array<{ id: number; migration_file: string }>>('id', 'migration_file');

  for (const task of legacyTasks) {
    await knex(Tables.TB_TASKS)
      .where({ id: task.id })
      .whereNull('migration_files')
      .update({ migration_files: JSON.stringify([task.migration_file]) });
  }

  await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
    table.dropColumn('migration_file');
  });
}

/** Satu entri history awal per task, memakai status + created_at yang sekarang. */
async function backfillHistory(knex: Knex): Promise<void> {
  const tasks = await knex(Tables.TB_TASKS)
    .leftJoin(Tables.TB_TASK_HISTORY, `${Tables.TB_TASK_HISTORY}.task_id`, `${Tables.TB_TASKS}.id`)
    .whereNull(`${Tables.TB_TASK_HISTORY}.id`)
    .select<Array<{ id: number; status: string; created_at: Date | null }>>(
      `${Tables.TB_TASKS}.id`,
      `${Tables.TB_TASKS}.status`,
      `${Tables.TB_TASKS}.created_at`,
    );

  if (tasks.length === 0) return;

  await knex(Tables.TB_TASK_HISTORY).insert(
    tasks.map((task) => ({
      task_id: task.id,
      status: task.status,
      notes: null,
      changed_at: task.created_at ?? knex.fn.now(),
    })),
  );
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;

  // Kembalikan nilai "Done" di ENUM (tanpa mengubah status baris yang ada).
  if (!(await enumHasValue(knex, Tables.TB_TASKS, 'status', 'Done'))) {
    await knex.raw(
      `ALTER TABLE ?? MODIFY COLUMN status ENUM(${enumSql(TASK_STATUS_ENUM_DOWN)}) NOT NULL`,
      [Tables.TB_TASKS],
    );
  }

  // Balikkan deskripsi pertama ke kolom lama `description`.
  if (!(await knex.schema.hasColumn(Tables.TB_TASKS, 'description'))) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.text('description').nullable();
    });

    if (await knex.schema.hasTable(Tables.TB_TASK_DESCRIPTIONS)) {
      const descriptions = await knex(Tables.TB_TASK_DESCRIPTIONS)
        .orderBy('id', 'asc')
        .select<Array<{ task_id: number; content: string }>>('task_id', 'content');

      for (const row of descriptions) {
        await knex(Tables.TB_TASKS)
          .where({ id: row.task_id })
          .whereNull('description')
          .update({ description: row.content });
      }
    }
  }

  await knex.schema.dropTableIfExists(Tables.TB_TASK_HISTORY);
  await knex.schema.dropTableIfExists(Tables.TB_TASK_DESCRIPTIONS);

  if (await knex.schema.hasColumn(Tables.TB_TASKS, 'migration_files')) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropColumn('migration_files');
    });
  }

  if (await knex.schema.hasColumn(Tables.TB_TASKS, 'parent_task_id')) {
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropForeign('parent_task_id');
    });
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropIndex(['parent_task_id'], 'tb_tasks_parent_idx');
    });
    await knex.schema.alterTable(Tables.TB_TASKS, (table) => {
      table.dropColumn('parent_task_id');
    });
  }
}

