import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Todo per task (checklist). 1 task → banyak todo.
 *
 * - `title` wajib, `description` HTML opsional (seperti deskripsi task).
 * - `is_done` untuk checkbox selesai/belum.
 * - FK task ON DELETE CASCADE; urut `id` naik (urutan penambahan).
 * - Idempotent: aman dijalankan ulang / saat task board belum ada.
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) return;
  if (await knex.schema.hasTable(Tables.TB_TASK_TODOS)) return;

  await knex.schema.createTable(Tables.TB_TASK_TODOS, (table) => {
    table.increments('id').unsigned().primary();
    table.integer('task_id').unsigned().notNullable();
    table
      .foreign('task_id')
      .references(`${Tables.TB_TASKS}.id`)
      .onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.text('description').notNullable();
    table.boolean('is_done').notNullable().defaultTo(false);
    table.timestamps(true, true);

    table.index(['task_id'], 'tb_task_todos_task_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.TB_TASK_TODOS);
}
