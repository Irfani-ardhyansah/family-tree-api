import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import type {
  Task,
  TaskCreateInput,
  TaskDescription,
  TaskDescriptionInput,
  TaskHistoryEntry,
  TaskListQuery,
  TaskTodo,
  TaskTodoUpdateInput,
  TaskUpdateInput,
} from './task-board.types';
import { taskBoardRepository } from './task-board.repository';
import { taskBoardWorkplaceRepository } from './task-board.workplace.repository';

const TASK_TYPES = ['Bugfixing', 'Feature', 'Refactor'] as const;
/** Status yang valid. "Done" sudah dihapus — status terakhir task adalah "Merged". */
const TASK_STATUSES = ['To-Do', 'In Progress', 'Merged'] as const;
/** Status lama yang masih dikirim klien lama → dijawab pesan khusus. */
const REMOVED_TASK_STATUSES = ['Done'] as const;
const LINK_TYPES = ['discord', 'notion', 'mr'] as const;

/** Judul entri deskripsi saat klien masih mengirim `description` (string tunggal). */
const LEGACY_DESCRIPTION_TITLE = 'Deskripsi';
const MAX_DESCRIPTION_TITLE = 255;
const MAX_DESCRIPTION_CONTENT = 100000;
const MAX_DESCRIPTION_COUNT = 50;
const MAX_MIGRATION_FILES = 50;
const MAX_MIGRATION_FILE_NAME = 255;
const MIGRATION_FILE_EXTENSIONS = ['.ts', '.js', '.sql'] as const;
const MAX_NOTES_LENGTH = 5000;
const MAX_TODO_TITLE = 255;
const MAX_TODO_DESCRIPTION = 100000;

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
  if (typeof value === 'string' && REMOVED_TASK_STATUSES.includes(value as any)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} "${value}" sudah tidak dipakai. Status yang valid: ${TASK_STATUSES.join(', ')}.`,
    );
  }
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

/** Deskripsi todo: `undefined` = tidak diubah, `null`/'' = dikosongkan. */
function parseTodoDescription(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) return undefined;
  if (value === null) return '';
  if (typeof value !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus string.`);
  }
  if (value.length > MAX_TODO_DESCRIPTION) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${MAX_TODO_DESCRIPTION} karakter.`,
    );
  }
  return value;
}

function parseBooleanFlag(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus boolean.`);
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

function parseOptionalId(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus id berupa angka positif.`);
  }
  return parsed;
}

/** `undefined` = field tidak dikirim, `null` = lepas relasi revisi. */
function parseParentTaskId(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const id = parseOptionalId(value, field);
  if (id === undefined) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus id berupa angka positif.`);
  }
  return id;
}

/** `undefined` = tidak dikirim, `null` = lepas tempat kerja. */
function parseWorkplaceId(
  value: unknown,
  field: string,
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const id = parseOptionalId(value, field);
  if (id === undefined) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus id berupa angka positif.`,
    );
  }
  return id;
}

/** Array id urut untuk reorder: non-kosong, bilangan bulat positif, tanpa duplikat. */
function parseReorderIds(value: unknown, field: string): number[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus array id dan tidak boleh kosong.`,
    );
  }

  const ids = value.map((item, index) => {
    const parsed = typeof item === 'string' ? Number(item) : item;
    if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed <= 0) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `${field}[${index}] harus id berupa angka positif.`,
      );
    }
    return parsed;
  });

  if (new Set(ids).size !== ids.length) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} memuat id duplikat.`,
    );
  }

  return ids;
}

function parseDescriptions(
  value: unknown,
  field: string,
  required: boolean,
): TaskDescriptionInput[] | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `${field} wajib diisi, minimal satu entri { title, content }.`,
      );
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus berupa array { title, content }.`,
    );
  }

  if (value.length === 0) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} minimal berisi satu entri.`);
  }

  if (value.length > MAX_DESCRIPTION_COUNT) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} maksimal ${MAX_DESCRIPTION_COUNT} entri.`,
    );
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field}[${index}] tidak valid.`);
    }

    const item = entry as Record<string, unknown>;
    const title = parseNonEmptyString(item.title, `${field}[${index}].title`, MAX_DESCRIPTION_TITLE);
    const content = parseNonEmptyString(
      item.content,
      `${field}[${index}].content`,
      MAX_DESCRIPTION_CONTENT,
    );
    const id = parseOptionalId(item.id, `${field}[${index}].id`);

    return id === undefined ? { title, content } : { id, title, content };
  });
}

/** Nama file migration: tanpa path, harus berekstensi .ts / .js / .sql, tanpa duplikat. */
function parseMigrationFiles(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  if (!Array.isArray(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'migration_files harus berupa array nama file.',
    );
  }

  if (value.length > MAX_MIGRATION_FILES) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `migration_files maksimal ${MAX_MIGRATION_FILES} entri.`,
    );
  }

  const files = value.map((item, index) => {
    const name = parseNonEmptyString(item, `migration_files[${index}]`, MAX_MIGRATION_FILE_NAME);

    if (name.includes('/') || name.includes('\\')) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `migration_files[${index}] harus nama file, bukan path.`,
      );
    }

    if (!MIGRATION_FILE_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `migration_files[${index}] harus berakhiran: ${MIGRATION_FILE_EXTENSIONS.join(', ')}.`,
      );
    }

    return name;
  });

  return Array.from(new Set(files));
}

/**
 * Deskripsi dari `descriptions` (format baru) atau `description` (string
 * tunggal, format lama). Keduanya tidak boleh dikirim bersamaan.
 * Saat create, minimal satu deskripsi wajib ada.
 */
function resolveDescriptions(
  raw: Record<string, unknown>,
  field: string,
  required: boolean,
): TaskDescriptionInput[] | undefined {
  const hasNew = raw.descriptions !== undefined && raw.descriptions !== null;
  const hasLegacy = raw.description !== undefined && raw.description !== null;

  if (hasNew && hasLegacy) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} dan description tidak boleh dikirim bersamaan. Pakai ${field} (array { title, content }); field description sudah tidak dipakai.`,
    );
  }

  if (hasNew) {
    return parseDescriptions(raw.descriptions, field, required);
  }

  if (hasLegacy) {
    const content = parseOptionalString(raw.description, 'description', MAX_DESCRIPTION_CONTENT);
    if (!content) {
      return parseDescriptions(undefined, field, required);
    }
    return [{ title: LEGACY_DESCRIPTION_TITLE, content }];
  }

  return parseDescriptions(undefined, field, required);
}

export class TaskBoardService {
  async list(personId: number, query: TaskListQuery = {}): Promise<Task[]> {
    const filters: TaskListQuery = {};

    if (query.type) {
      filters.type = parseTaskType(query.type, 'type');
    }
    if (query.status) {
      filters.status = parseTaskStatus(query.status, 'status');
    }
    if (typeof query.search === 'string' && query.search.trim() !== '') {
      filters.search = query.search.trim();
    }
    if (query.workplace_id !== undefined && query.workplace_id !== null) {
      const workplaceId = parseOptionalId(query.workplace_id, 'workplace_id');
      if (workplaceId !== undefined) filters.workplace_id = workplaceId;
    }

    return taskBoardRepository.list(personId, filters);
  }

  async getById(personId: number, taskId: number): Promise<Task> {
    const task = await taskBoardRepository.findById(personId, taskId, { includeRelations: true });
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }
    return task;
  }

  /** GET /tasks/:id/history — riwayat aksi task (status, deskripsi, revisi), terbaru lebih dulu. */
  async getHistory(personId: number, taskId: number): Promise<TaskHistoryEntry[]> {
    const task = await taskBoardRepository.findRowById(personId, taskId);
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }

    return taskBoardRepository.getHistory(taskId);
  }

  /** GET /tasks/:id/revisions — daftar revisi (task anak) dari sebuah task. */
  async getRevisions(personId: number, taskId: number): Promise<Task[]> {
    const task = await taskBoardRepository.findRowById(personId, taskId);
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }

    return taskBoardRepository.getRevisions(personId, taskId);
  }

  /* ---------------------------- Reorder ---------------------------- */

  /** PUT /tasks/reorder — simpan urutan manual list task. */
  async reorder(personId: number, body: unknown): Promise<Task[]> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const ids = parseReorderIds(raw.order, 'order');

    const owned = await taskBoardRepository.findOwnedTaskIds(personId, ids);
    if (owned.length !== ids.length) {
      const ownedSet = new Set(owned);
      const invalid = ids.find((id) => !ownedSet.has(id));
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `Task #${invalid} tidak ditemukan.`,
      );
    }

    await taskBoardRepository.reorderTasks(personId, ids);
    return taskBoardRepository.list(personId, {});
  }

  /** PUT /tasks/:id/descriptions/reorder — simpan urutan penjelasan. */
  async reorderDescriptions(
    personId: number,
    taskId: number,
    body: unknown,
  ): Promise<TaskDescription[]> {
    await this.assertTaskExists(personId, taskId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const ids = parseReorderIds(raw.order, 'order');

    const existing = await taskBoardRepository.findDescriptionIds(taskId);
    const existingSet = new Set(existing);
    const invalid = ids.find((id) => !existingSet.has(id));
    if (invalid !== undefined || ids.length !== existing.length) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'order harus memuat tepat semua id penjelasan task ini.',
      );
    }

    await taskBoardRepository.reorderDescriptions(taskId, ids);
    return taskBoardRepository.listDescriptions(taskId);
  }

  /** PUT /tasks/:id/todos/reorder — simpan urutan todo. */
  async reorderTodos(
    personId: number,
    taskId: number,
    body: unknown,
  ): Promise<TaskTodo[]> {
    await this.assertTaskExists(personId, taskId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const ids = parseReorderIds(raw.order, 'order');

    const existing = await taskBoardRepository.findTodoIds(taskId);
    const existingSet = new Set(existing);
    const invalid = ids.find((id) => !existingSet.has(id));
    if (invalid !== undefined || ids.length !== existing.length) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'order harus memuat tepat semua id todo task ini.',
      );
    }

    await taskBoardRepository.reorderTodos(taskId, ids);
    return taskBoardRepository.listTodos(taskId);
  }

  /* ----------------------------- Todos ----------------------------- */

  async listTodos(personId: number, taskId: number): Promise<TaskTodo[]> {
    await this.assertTaskExists(personId, taskId);
    return taskBoardRepository.listTodos(taskId);
  }

  async createTodo(
    personId: number,
    taskId: number,
    body: unknown,
  ): Promise<TaskTodo> {
    await this.assertTaskExists(personId, taskId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const title = parseNonEmptyString(raw.title, 'title', MAX_TODO_TITLE);
    const description =
      parseTodoDescription(raw.description, 'description') ?? '';
    return taskBoardRepository.createTodo(taskId, { title, description });
  }

  async updateTodo(
    personId: number,
    taskId: number,
    todoId: number,
    body: unknown,
  ): Promise<TaskTodo> {
    await this.assertTaskExists(personId, taskId);
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    const patch: TaskTodoUpdateInput = {};
    if (raw.title !== undefined) {
      patch.title = parseNonEmptyString(raw.title, 'title', MAX_TODO_TITLE);
    }
    if (raw.description !== undefined) {
      patch.description =
        parseTodoDescription(raw.description, 'description') ?? '';
    }
    if (raw.is_done !== undefined) {
      patch.is_done = parseBooleanFlag(raw.is_done, 'is_done');
    }

    const updated = await taskBoardRepository.updateTodo(taskId, todoId, patch);
    if (!updated) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Todo tidak ditemukan.');
    }
    return updated;
  }

  async deleteTodo(
    personId: number,
    taskId: number,
    todoId: number,
  ): Promise<void> {
    await this.assertTaskExists(personId, taskId);
    const deleted = await taskBoardRepository.deleteTodo(taskId, todoId);
    if (!deleted) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Todo tidak ditemukan.');
    }
  }

  private async assertTaskExists(personId: number, taskId: number): Promise<void> {
    const task = await taskBoardRepository.findRowById(personId, taskId);
    if (!task) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Task tidak ditemukan.');
    }
  }

  private async assertWorkplaceOwned(
    personId: number,
    workplaceId: number,
  ): Promise<void> {
    const workplace = await taskBoardWorkplaceRepository.findById(
      personId,
      workplaceId,
    );
    if (!workplace) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'workplace_id tidak ditemukan atau bukan milikmu.',
      );
    }
  }

  async create(personId: number, body: unknown): Promise<Task> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }

    const raw = body as Record<string, unknown>;

    const type = parseTaskType(raw.type, 'type');
    const title = parseNonEmptyString(raw.title, 'title', 255);
    const branchName = parseNonEmptyString(raw.branchName, 'branchName', 255);
    // Create tanpa status dianggap "To-Do" (status awal task).
    const status =
      raw.status === undefined || raw.status === null || raw.status === ''
        ? 'To-Do'
        : parseTaskStatus(raw.status, 'status');
    const links = parseLinks(raw.links);
    const descriptions = resolveDescriptions(raw, 'descriptions', true);
    const deployNotes = parseOptionalString(raw.deployNotes, 'deployNotes', 100000);
    const migrationFiles = parseMigrationFiles(raw.migration_files);
    const parentTaskId = parseParentTaskId(raw.parent_task_id, 'parent_task_id');
    const workplaceId = parseWorkplaceId(raw.workplace_id, 'workplace_id');
    const notes = parseOptionalString(raw.notes ?? raw.statusNotes, 'notes', MAX_NOTES_LENGTH);

    if (parentTaskId !== undefined && parentTaskId !== null) {
      await this.assertRevisionParent(personId, parentTaskId);
    }
    if (workplaceId !== undefined && workplaceId !== null) {
      await this.assertWorkplaceOwned(personId, workplaceId);
    }

    return taskBoardRepository.create(personId, {
      type,
      title,
      branch_name: branchName,
      status,
      links,
      descriptions,
      deploy_notes: deployNotes,
      migration_files: migrationFiles,
      parent_task_id: parentTaskId ?? null,
      workplace_id: workplaceId ?? null,
      status_notes: notes,
    });
  }

  async update(personId: number, taskId: number, body: unknown): Promise<Task> {
    const existing = await taskBoardRepository.findRowById(personId, taskId);
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
    if (raw.deployNotes !== undefined) {
      updateData.deploy_notes = parseOptionalString(raw.deployNotes, 'deployNotes', 100000);
    }
    if (raw.migration_files !== undefined) {
      updateData.migration_files = parseMigrationFiles(raw.migration_files) ?? [];
    }

    const descriptions = resolveDescriptions(raw, 'descriptions', false);
    if (descriptions !== undefined) {
      updateData.descriptions = descriptions;
    }

    const parentTaskId = parseParentTaskId(raw.parent_task_id, 'parent_task_id');
    if (parentTaskId !== undefined) {
      if (parentTaskId !== null) {
        await this.assertRevisionParent(personId, parentTaskId, taskId);
      }
      updateData.parent_task_id = parentTaskId;
    }

    const workplaceId = parseWorkplaceId(raw.workplace_id, 'workplace_id');
    if (workplaceId !== undefined) {
      if (workplaceId !== null) {
        await this.assertWorkplaceOwned(personId, workplaceId);
      }
      updateData.workplace_id = workplaceId;
    }

    const notes = parseOptionalString(raw.notes ?? raw.statusNotes, 'notes', MAX_NOTES_LENGTH);
    if (notes !== undefined) {
      updateData.status_notes = notes;
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

  /**
   * Task induk harus ada, dan revisi hanya boleh dibuat dari task berstatus
   * "Merged". Sekaligus mencegah siklus (A revisi dari B, B revisi dari A).
   */
  private async assertRevisionParent(
    personId: number,
    parentTaskId: number,
    currentTaskId?: number,
  ): Promise<void> {
    if (currentTaskId !== undefined && parentTaskId === currentTaskId) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'parent_task_id tidak boleh menunjuk task itu sendiri.',
      );
    }

    const parent = await taskBoardRepository.findRowById(personId, parentTaskId);
    if (!parent) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Task induk (parent_task_id) tidak ditemukan.',
      );
    }

    if (parent.status !== 'Merged') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `Revisi hanya boleh dibuat dari task berstatus "Merged". Status task induk saat ini: "${parent.status}".`,
      );
    }

    let cursor = parent.parent_task_id;
    const visited = new Set<number>([parentTaskId]);

    while (cursor !== null && cursor !== undefined) {
      if (currentTaskId !== undefined && cursor === currentTaskId) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'parent_task_id membuat rantai revisi berputar (siklus).',
        );
      }
      if (visited.has(cursor)) break;

      visited.add(cursor);
      const ancestor = await taskBoardRepository.findRowById(personId, cursor);
      cursor = ancestor?.parent_task_id ?? null;
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
