import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import type { Task, TaskCreateInput, TaskUpdateInput, TaskListQuery, TaskLink, TaskImage } from './task-board.types';

export class TaskBoardRepository {
  async list(personId: number, query: TaskListQuery = {}): Promise<Task[]> {
    let q = db(Tables.TB_TASKS)
      .where({ person_id: personId })
      .orderBy('updated_at', 'desc');

    if (query.type) {
      q = q.where({ type: query.type });
    }

    if (query.status) {
      q = q.where({ status: query.status });
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      q = q.where((builder) => {
        builder
          .where('title', 'like', searchPattern)
          .orWhere('description', 'like', searchPattern)
          .orWhere('deploy_notes', 'like', searchPattern);
      });
    }

    const tasks = await q.select('*');

    // Fetch links and images for each task
    for (const task of tasks) {
      task.links = await this.getTaskLinks(task.id);
      task.images = await this.getTaskImages(task.id);
    }

    return tasks;
  }

  async findById(personId: number, taskId: number): Promise<Task | undefined> {
    const task = await db(Tables.TB_TASKS)
      .where({ id: taskId, person_id: personId })
      .first('*');

    if (!task) return undefined;

    task.links = await this.getTaskLinks(task.id);
    task.images = await this.getTaskImages(task.id);

    return task;
  }

  async create(personId: number, input: TaskCreateInput): Promise<Task> {
    const [taskId] = await db(Tables.TB_TASKS).insert({
      person_id: personId,
      type: input.type,
      title: input.title,
      branch_name: input.branch_name,
      status: input.status,
      description: input.description ?? null,
      deploy_notes: input.deploy_notes ?? null,
    });

    const task = (await this.findById(personId, taskId))!;

    // Create links if provided
    if (input.links && input.links.length > 0) {
      for (const link of input.links) {
        await db(Tables.TB_TASK_LINKS).insert({
          task_id: taskId,
          type: link.type,
          url: link.url,
        });
      }
      task.links = await this.getTaskLinks(taskId);
    }

    return task;
  }

  async update(
    personId: number,
    taskId: number,
    input: TaskUpdateInput,
  ): Promise<Task | undefined> {
    const task = await this.findById(personId, taskId);
    if (!task) return undefined;

    // Update task fields
    const updateData: any = {};
    if (input.type !== undefined) updateData.type = input.type;
    if (input.title !== undefined) updateData.title = input.title;
    if (input.branch_name !== undefined) updateData.branch_name = input.branch_name;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.deploy_notes !== undefined) updateData.deploy_notes = input.deploy_notes;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = db.fn.now();
      await db(Tables.TB_TASKS)
        .where({ id: taskId, person_id: personId })
        .update(updateData);
    }

    // Update links if provided
    if (input.links !== undefined) {
      // Delete existing links
      await db(Tables.TB_TASK_LINKS).where({ task_id: taskId }).del();

      // Insert new links
      for (const link of input.links) {
        await db(Tables.TB_TASK_LINKS).insert({
          task_id: taskId,
          type: link.type,
          url: link.url,
        });
      }
    }

    return this.findById(personId, taskId);
  }

  async delete(personId: number, taskId: number): Promise<boolean> {
    const task = await this.findById(personId, taskId);
    if (!task) return false;

    await db(Tables.TB_TASKS)
      .where({ id: taskId, person_id: personId })
      .del();

    return true;
  }

  async addImage(taskId: number, url: string): Promise<void> {
    await db(Tables.TB_TASK_IMAGES).insert({
      task_id: taskId,
      url,
    });
  }

  private async getTaskLinks(taskId: number): Promise<TaskLink[]> {
    return db(Tables.TB_TASK_LINKS)
      .where({ task_id: taskId })
      .select('*');
  }

  private async getTaskImages(taskId: number): Promise<TaskImage[]> {
    return db(Tables.TB_TASK_IMAGES)
      .where({ task_id: taskId })
      .select('*');
  }
}

export const taskBoardRepository = new TaskBoardRepository();
