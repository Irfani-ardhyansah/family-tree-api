import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Create task board tables for personal development task tracking
 */
export async function up(knex: Knex): Promise<void> {
  // Create tasks table
  if (!(await knex.schema.hasTable(Tables.TB_TASKS))) {
    await knex.schema.createTable(Tables.TB_TASKS, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('person_id').unsigned().notNullable();
      table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
      table
        .enum('type', ['Bugfixing', 'Feature', 'Refactor'])
        .notNullable();
      table.string('title', 255).notNullable();
      table.string('branch_name', 255).notNullable();
      table
        .enum('status', ['To-Do', 'In Progress', 'Merged', 'Done'])
        .notNullable();
      table.text('description').nullable();
      table.text('deploy_notes').nullable();
      table.timestamps(true, true);

      table.index(['person_id'], 'tb_tasks_person_idx');
      table.index(['status'], 'tb_tasks_status_idx');
      table.index(['type'], 'tb_tasks_type_idx');
      table.index(['updated_at'], 'tb_tasks_updated_idx');
    });
  }

  // Create task links table
  if (!(await knex.schema.hasTable(Tables.TB_TASK_LINKS))) {
    await knex.schema.createTable(Tables.TB_TASK_LINKS, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('task_id').unsigned().notNullable();
      table.foreign('task_id').references(`${Tables.TB_TASKS}.id`).onDelete('CASCADE');
      table.enum('type', ['discord', 'notion', 'mr']).notNullable();
      table.string('url', 2048).notNullable();
      table.timestamps(true, true);

      table.index(['task_id'], 'tb_task_links_task_idx');
    });
  }

  // Create task images table
  if (!(await knex.schema.hasTable(Tables.TB_TASK_IMAGES))) {
    await knex.schema.createTable(Tables.TB_TASK_IMAGES, (table) => {
      table.increments('id').unsigned().primary();
      table.integer('task_id').unsigned().notNullable();
      table.foreign('task_id').references(`${Tables.TB_TASKS}.id`).onDelete('CASCADE');
      table.string('url', 2048).notNullable();
      table.timestamps(true, true);

      table.index(['task_id'], 'tb_task_images_task_idx');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.TB_TASK_IMAGES);
  await knex.schema.dropTableIfExists(Tables.TB_TASK_LINKS);
  await knex.schema.dropTableIfExists(Tables.TB_TASKS);
}
