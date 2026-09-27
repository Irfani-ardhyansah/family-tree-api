import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import type { Task, TaskCreateInput, TaskUpdateInput, TaskListQuery } from './task-board.types';
import { taskBoardRepository } from './task-board.repository';

const TASK_TYPES = ['Bugfixing', 'Feature', 'Refactor'] as const;
const TASK_STATUSES = ['To-Do', 'In Progress', 'Merged', 'Done'] as const;
const LINK_TYPES = ['discord', 'notion', 'mr'] as const;

function parseTaskType(value: unknown, field: string): TaskCreateInput['type'] {
  if (typeof value !== 'string' || !TASK_TYPES.includes(value as any)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${TASK_TYPES.join(', ')}`,
    );
  }
  return value as TaskCreateInput['type'];
}

function parseTaskStatus(value: unknown, field: string): TaskCreateInput['status'] {
  if (typeof value !== 'string' || !TASK_STATUSES.includes(value as any)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${TASK_STATUSES.join(', ')}`,
    );
  }
  return value as TaskCreateInput['status'];
}

function parseLinkType(value: unknown, field: string): 'discord' | 'notion' | 'mr' {
  if (typeof value !== 'string' || !LINK_TYPES.includes(value as any)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${LINK_TYPES.join(', ')}`,
    );
  }
  return value as 'discord' | 'notion' | 'mr';
}

function parseNonEmptyString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} wajib diisi.`);
  }
  if (value.length > maxLength) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${maxLength} karakter.`,
    );
  }
  return value.trim();
}

function parseOptionalString(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus berupa string.`);
  }
  if (value.length > maxLength) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${maxLength} karakter.`,
    );
  }
  return value;
}

function parseLinks(value: unknown): Array<{ type: 'discord' | 'notion' | 'mr'; url: string }> {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'links harus berupa array.');
  }

  return value.map((link, index) => {
    if (!link || typeof link !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `links[${index}] tidak valid.`);
    }
    const linkObj = link as Record<string, unknown>;

    const type = parseLinkType(linkObj.type, `links[${index}].type`);
    const url = parseNonEmptyString(linkObj.url, `links[${index}].url`, 2048);

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `links[${index}].url harus URL valid.`);
    }

    return { type, url };
  });
}

export class TaskBoardService {
  async list(personId: number, query: TaskListQuery = {}): Promise<Task[]> {
    return taskBoardRepository.list(personId, query);
  }

  async getById(personId: number, taskId: number): Promise<Task> {
    const task = await taskBoardRepository.findById(personId, taskId);
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }
    return task;
  }

  async create(personId: number, body: unknown): Promise<Task> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }

    const raw = body as Record<string, unknown>;

    const type = parseTaskType(raw.type, 'type');
    const title = parseNonEmptyString(raw.title, 'title', 255);
    const branchName = parseNonEmptyString(raw.branchName, 'branchName', 255);
    const status = parseTaskStatus(raw.status, 'status');
    const links = parseLinks(raw.links);
    const description = parseOptionalString(raw.description, 'description', 100000);
    const deployNotes = parseOptionalString(raw.deployNotes, 'deployNotes', 100000);

    return taskBoardRepository.create(personId, {
      type,
      title,
      branch_name: branchName,
      status,
      links,
      description,
      deploy_notes: deployNotes,
    });
  }

  async update(personId: number, taskId: number, body: unknown): Promise<Task> {
    const existing = await taskBoardRepository.findById(personId, taskId);
    if (!existing) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }

    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }

    const raw = body as Record<string, unknown>;
    const updateData: TaskUpdateInput = {};

    if (raw.type !== undefined) {
      updateData.type = parseTaskType(raw.type, 'type');
    }
    if (raw.title !== undefined) {
      updateData.title = parseNonEmptyString(raw.title, 'title', 255);
    }
    if (raw.branchName !== undefined) {
      updateData.branch_name = parseNonEmptyString(raw.branchName, 'branchName', 255);
    }
    if (raw.status !== undefined) {
      updateData.status = parseTaskStatus(raw.status, 'status');
    }
    if (raw.links !== undefined) {
      updateData.links = parseLinks(raw.links);
    }
    if (raw.description !== undefined) {
      updateData.description = parseOptionalString(raw.description, 'description', 100000);
    }
    if (raw.deployNotes !== undefined) {
      updateData.deploy_notes = parseOptionalString(raw.deployNotes, 'deployNotes', 100000);
    }

    const updated = await taskBoardRepository.update(personId, taskId, updateData);
    return updated!;
  }

  async delete(personId: number, taskId: number): Promise<void> {
    const deleted = await taskBoardRepository.delete(personId, taskId);
    if (!deleted) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }
  }

  async uploadImage(personId: number, taskId: number, file: any): Promise<{ url: string }> {
    const task = await taskBoardRepository.findById(personId, taskId);
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }

    // For now, use the existing media storage system
    // In production, this would upload to a proper storage service
    const url = `/media/uploads/tasks/${taskId}/${Date.now()}-${file.originalname}`;

    await taskBoardRepository.addImage(taskId, url);

    return { url };
  }
}

export const taskBoardService = new TaskBoardService();
