import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import type {
  EmploymentType,
  Workplace,
  WorkplaceUpdateInput,
} from './task-board.types';
import { taskBoardWorkplaceRepository } from './task-board.workplace.repository';

const EMPLOYMENT_TYPES: EmploymentType[] = [
  'Fulltime',
  'Freelance',
  'Part-time',
  'Contract',
  'Personal',
];

const MAX_NAME = 120;
const MAX_ROLE = 120;
const MAX_LOCATION = 160;
const MAX_ACCENT = 24;

function requireBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
  }
  return body as Record<string, unknown>;
}

function parseEmploymentType(value: unknown, field: string): EmploymentType {
  if (typeof value !== 'string' || !EMPLOYMENT_TYPES.includes(value as EmploymentType)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${EMPLOYMENT_TYPES.join(', ')}`,
    );
  }
  return value as EmploymentType;
}

function parseName(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} wajib diisi.`);
  }
  if (value.length > MAX_NAME) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${MAX_NAME} karakter.`,
    );
  }
  return value.trim();
}

/** `undefined` = tidak dikirim, `null` = dikosongkan. */
function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus string.`);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > maxLength) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${maxLength} karakter.`,
    );
  }
  return trimmed;
}

/** `undefined` = tidak dikirim, `null` = dikosongkan. Disimpan `YYYY-MM-DD`. */
function parseOptionalDate(
  value: unknown,
  field: string,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus tanggal.`);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus tanggal valid (YYYY-MM-DD).`,
    );
  }
  return date.toISOString().slice(0, 10);
}

export class TaskBoardWorkplaceService {
  async list(personId: number): Promise<Workplace[]> {
    return taskBoardWorkplaceRepository.list(personId);
  }

  async create(personId: number, body: unknown): Promise<Workplace> {
    const raw = requireBody(body);
    return taskBoardWorkplaceRepository.create(personId, {
      name: parseName(raw.name, 'name'),
      employment_type: parseEmploymentType(
        raw.employment_type ?? raw.employmentType,
        'employment_type',
      ),
      role: parseOptionalText(raw.role, 'role', MAX_ROLE) ?? null,
      location: parseOptionalText(raw.location, 'location', MAX_LOCATION) ?? null,
      accent: parseOptionalText(raw.accent, 'accent', MAX_ACCENT) ?? null,
      started_at:
        parseOptionalDate(raw.started_at ?? raw.startedAt, 'started_at') ?? null,
      ended_at:
        parseOptionalDate(raw.ended_at ?? raw.endedAt, 'ended_at') ?? null,
    });
  }

  async update(
    personId: number,
    workplaceId: number,
    body: unknown,
  ): Promise<Workplace> {
    await this.assertExists(personId, workplaceId);
    const raw = requireBody(body);
    const update: WorkplaceUpdateInput = {};

    if (raw.name !== undefined) {
      update.name = parseName(raw.name, 'name');
    }
    const employment = raw.employment_type ?? raw.employmentType;
    if (employment !== undefined) {
      update.employment_type = parseEmploymentType(employment, 'employment_type');
    }
    if (raw.role !== undefined) {
      update.role = parseOptionalText(raw.role, 'role', MAX_ROLE) ?? null;
    }
    if (raw.location !== undefined) {
      update.location = parseOptionalText(raw.location, 'location', MAX_LOCATION) ?? null;
    }
    if (raw.accent !== undefined) {
      update.accent = parseOptionalText(raw.accent, 'accent', MAX_ACCENT) ?? null;
    }
    if (raw.started_at !== undefined || raw.startedAt !== undefined) {
      update.started_at =
        parseOptionalDate(raw.started_at ?? raw.startedAt, 'started_at') ?? null;
    }
    if (raw.ended_at !== undefined || raw.endedAt !== undefined) {
      update.ended_at =
        parseOptionalDate(raw.ended_at ?? raw.endedAt, 'ended_at') ?? null;
    }

    const updated = await taskBoardWorkplaceRepository.update(
      personId,
      workplaceId,
      update,
    );
    return updated!;
  }

  async archive(personId: number, workplaceId: number): Promise<Workplace> {
    const existing = await this.assertExists(personId, workplaceId);
    if (existing.is_default) {
      throw new AppError(
        422,
        ErrorCodes.DEFAULT_WORKPLACE_PROTECTED,
        'Tempat kerja default tidak bisa diarsipkan.',
      );
    }
    const updated = await taskBoardWorkplaceRepository.setArchived(
      personId,
      workplaceId,
      true,
    );
    return updated!;
  }

  async unarchive(personId: number, workplaceId: number): Promise<Workplace> {
    await this.assertExists(personId, workplaceId);
    const updated = await taskBoardWorkplaceRepository.setArchived(
      personId,
      workplaceId,
      false,
    );
    return updated!;
  }

  async remove(personId: number, workplaceId: number): Promise<void> {
    const existing = await this.assertExists(personId, workplaceId);
    if (existing.is_default) {
      throw new AppError(
        422,
        ErrorCodes.DEFAULT_WORKPLACE_PROTECTED,
        'Tempat kerja default tidak bisa dihapus.',
      );
    }

    const taskCount = await taskBoardWorkplaceRepository.countTasks(
      personId,
      workplaceId,
    );
    if (taskCount > 0) {
      throw new AppError(
        409,
        ErrorCodes.WORKPLACE_HAS_TASKS,
        `Tempat kerja masih punya ${taskCount} task. Arsipkan saja.`,
      );
    }

    await taskBoardWorkplaceRepository.delete(personId, workplaceId);
  }

  private async assertExists(
    personId: number,
    workplaceId: number,
  ): Promise<Workplace> {
    const workplace = await taskBoardWorkplaceRepository.findById(
      personId,
      workplaceId,
    );
    if (!workplace) {
      throw new AppError(
        404,
        ErrorCodes.WORKPLACE_NOT_FOUND,
        'Tempat kerja tidak ditemukan.',
      );
    }
    return workplace;
  }
}

export const taskBoardWorkplaceService = new TaskBoardWorkplaceService();
