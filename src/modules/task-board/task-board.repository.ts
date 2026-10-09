import type { Knex } from 'knex';
import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import type {
  Task,
  TaskCreateInput,
  TaskUpdateInput,
  TaskListQuery,
  TaskLink,
  TaskImage,
  TaskDescription,
  TaskDescriptionInput,
  TaskHistoryEntry,
  TaskHistoryAction,
  TaskStatus,
  TaskTodo,
  TaskTodoCreateInput,
  TaskTodoUpdateInput,
  TaskType,
} from './task-board.types';
import {
  diffDescriptions,
  type DescriptionDiff,
  type DescriptionSnapshot,
} from './task-board.descriptions';

/** Baris history yang siap diinsert (aksi apa pun). */
interface TaskHistoryInsert {
  task_id: number;
  action: TaskHistoryAction;
  status: string;
  notes: string | null;
  related_task_id?: number | null;
}

/** Baris mentah `tb_tasks`. Kolom JSON bisa datang sebagai string atau object. */
interface TaskRow {
  id: number;
  person_id: number;
  type: TaskType;
  title: string;
  branch_name: string;
  status: TaskStatus;
  deploy_notes: string | null;
  migration_files: unknown;
  parent_task_id: number | null;
  workplace_id: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Baris relasi task (link/image) dan deskripsi, sudah termasuk task_id-nya. */
type TaskLinkRow = TaskLink & { task_id: number };
type TaskImageRow = TaskImage & { task_id: number };
type TaskDescriptionRow = {
  id: number;
  task_id: number;
  title: string;
  content: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/** Baris mentah `tb_task_todos`. `is_done` bisa boolean atau 0/1 dari mysql2. */
interface TaskTodoRow {
  id: number;
  task_id: number;
  title: string;
  description: string;
  is_done: boolean | number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function toTaskTodo(row: TaskTodoRow): TaskTodo {
  return {
    id: row.id,
    task_id: row.task_id,
    title: row.title,
    description: row.description,
    is_done: row.is_done === true || row.is_done === 1,
    sort_order: row.sort_order,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** mysql2 bisa mengembalikan kolom JSON sebagai string — normalkan jadi array. */
function parseMigrationFiles(value: unknown): string[] {
  if (value === null || value === undefined) return [];

  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is string => typeof item === 'string');
}

function serializeMigrationFiles(files: string[] | undefined): string | null {
  if (!files || files.length === 0) return null;
  return JSON.stringify(files);
}

function groupByTaskId<T extends { task_id: number }>(rows: T[]): Map<number, T[]> {
  const grouped = new Map<number, T[]>();

  for (const row of rows) {
    const list = grouped.get(row.task_id);
    if (list) {
      list.push(row);
    } else {
      grouped.set(row.task_id, [row]);
    }
  }

  return grouped;
}

function toTask(
  row: TaskRow,
  descriptions: TaskDescription[],
  links: TaskLink[],
  images: TaskImage[],
  history?: TaskHistoryEntry[],
): Task {
  return {
    ...row,
    migration_files: parseMigrationFiles(row.migration_files),
    descriptions,
    // Backward compatibility: klien lama masih membaca `description`.
    description: descriptions.length > 0 ? descriptions[0].content : null,
    links,
    images,
    ...(history ? { history } : {}),
  };
}

export class TaskBoardRepository {
  async list(personId: number, query: TaskListQuery = {}): Promise<Task[]> {
    let q = db(Tables.TB_TASKS).where({ person_id: personId });

    if (query.type) {
      q = q.where({ type: query.type });
    }

    if (query.status) {
      q = q.where({ status: query.status });
    }

    if (query.workplace_id) {
      q = q.where({ workplace_id: query.workplace_id });
    }

    if (query.search) {
      const searchPattern = `%${query.search}%`;
      q = q.where((builder) => {
        builder
          .where('title', 'like', searchPattern)
          .orWhere('deploy_notes', 'like', searchPattern)
          .orWhere('migration_files', 'like', searchPattern)
          .orWhereIn(
            'id',
            db(Tables.TB_TASK_DESCRIPTIONS)
              .select('task_id')
              .where('title', 'like', searchPattern)
              .orWhere('content', 'like', searchPattern),
          );
      });
    }

    const rows = await q
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
      .select<TaskRow[]>('*');
    return this.hydrate(rows);
  }

  /** Baris mentah tanpa relasi — dipakai validasi (mis. cek status task induk). */
  async findRowById(personId: number, taskId: number): Promise<TaskRow | undefined> {
    if (!Number.isInteger(taskId)) return undefined;

    return db(Tables.TB_TASKS)
      .where({ id: taskId, person_id: personId })
      .first<TaskRow>('*');
  }

  async findById(
    personId: number,
    taskId: number,
    options: { includeRelations?: boolean } = {},
  ): Promise<Task | undefined> {
    const row = await this.findRowById(personId, taskId);
    if (!row) return undefined;

    const [task] = await this.hydrate([row]);

    if (options.includeRelations) {
      const [parentTask, revisions, history, todos] = await Promise.all([
        row.parent_task_id ? this.findParentTask(personId, row.parent_task_id) : undefined,
        this.getRevisions(personId, taskId),
        this.getHistory(taskId),
        this.listTodos(taskId),
      ]);

      task.parent_task = parentTask ?? null;
      task.revisions = revisions;
      task.history = history;
      task.todos = todos;
    }

    return task;
  }

  async create(personId: number, input: TaskCreateInput): Promise<Task> {
    const taskId = await db.transaction(async (trx) => {
      const [maxRow] = await trx(Tables.TB_TASKS)
        .where({ person_id: personId })
        .max<Array<{ max_order: number | null }>>({ max_order: 'sort_order' });
      const nextOrder =
        maxRow?.max_order === null || maxRow?.max_order === undefined
          ? 0
          : Number(maxRow.max_order) + 1;

      const [insertedId] = await trx(Tables.TB_TASKS).insert({
        person_id: personId,
        type: input.type,
        title: input.title,
        branch_name: input.branch_name,
        status: input.status,
        deploy_notes: input.deploy_notes ?? null,
        migration_files: serializeMigrationFiles(input.migration_files),
        parent_task_id: input.parent_task_id ?? null,
        workplace_id: input.workplace_id ?? null,
        sort_order: nextOrder,
      });

      const descriptions = input.descriptions ?? [];
      if (descriptions.length > 0) {
        await this.insertDescriptions(trx, insertedId, descriptions);
      }

      // Setiap task punya minimal satu entri history: pembuatannya.
      await trx(Tables.TB_TASK_HISTORY).insert({
        task_id: insertedId,
        action: 'created',
        status: input.status,
        notes: input.status_notes ?? null,
      });

      // Dibuat sebagai revisi → tulis entri `revision_created` di history INDUK,
      // dengan related_task_id menunjuk task anak ini (link ke detail child).
      if (input.parent_task_id) {
        await this.insertRevisionCreatedEntry(
          trx,
          personId,
          input.parent_task_id,
          insertedId as number,
          input.title,
        );
      }

      if (input.links && input.links.length > 0) {
        await this.replaceLinks(trx, insertedId, input.links);
      }

      return insertedId as number;
    });

    const task = await this.findById(personId, taskId, { includeRelations: true });
    return task!;
  }

  async update(
    personId: number,
    taskId: number,
    input: TaskUpdateInput,
  ): Promise<Task | undefined> {
    const existing = await this.findRowById(personId, taskId);
    if (!existing) return undefined;

    const nextStatus = input.status;

    await db.transaction(async (trx) => {
      const updateData: Record<string, unknown> = {};
      if (input.type !== undefined) updateData.type = input.type;
      if (input.title !== undefined) updateData.title = input.title;
      if (input.branch_name !== undefined) updateData.branch_name = input.branch_name;
      if (nextStatus !== undefined) updateData.status = nextStatus;
      if (input.deploy_notes !== undefined) updateData.deploy_notes = input.deploy_notes;
      if (input.migration_files !== undefined) {
        updateData.migration_files = serializeMigrationFiles(input.migration_files);
      }
      if (input.parent_task_id !== undefined) updateData.parent_task_id = input.parent_task_id;
      if (input.workplace_id !== undefined) updateData.workplace_id = input.workplace_id;

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = trx.fn.now();
        await trx(Tables.TB_TASKS)
          .where({ id: taskId, person_id: personId })
          .update(updateData);
      }

      let descriptionDiff: DescriptionDiff | undefined;
      if (input.descriptions !== undefined) {
        descriptionDiff = await this.replaceDescriptions(
          trx,
          taskId,
          input.descriptions,
        );
      }

      if (input.links !== undefined) {
        await this.replaceLinks(trx, taskId, input.links);
      }

      const statusAfter = nextStatus ?? existing.status;
      const historyRows: TaskHistoryInsert[] = [];

      // Deskripsi ditambah/diubah/dihapus → entri history (notes = judul entri).
      if (descriptionDiff) {
        for (const entry of descriptionDiff.added) {
          historyRows.push({
            task_id: taskId,
            action: 'description_added',
            status: statusAfter,
            notes: entry.title,
          });
        }
        for (const entry of descriptionDiff.updated) {
          historyRows.push({
            task_id: taskId,
            action: 'description_updated',
            status: statusAfter,
            notes: entry.title,
          });
        }
        for (const entry of descriptionDiff.removed) {
          historyRows.push({
            task_id: taskId,
            action: 'description_removed',
            status: statusAfter,
            notes: entry.title,
          });
        }
      }

      // Status berubah → tulis entri history baru (notes opsional).
      if (nextStatus !== undefined && nextStatus !== existing.status) {
        historyRows.push({
          task_id: taskId,
          action: 'status_changed',
          status: nextStatus,
          notes: input.status_notes ?? null,
        });
      }

      if (historyRows.length > 0) {
        await trx(Tables.TB_TASK_HISTORY).insert(historyRows);
      }

      // Relasi revisi melekat (task ini jadi anak baru, parent berganti, atau
      // sebelumnya tidak punya induk) → entri `revision_created` di history
      // induk BARU, related_task_id menunjuk task ini. Melepas induk
      // (`parent_task_id: null`) tidak menulis entri.
      if (
        input.parent_task_id !== undefined &&
        input.parent_task_id !== null &&
        input.parent_task_id !== existing.parent_task_id
      ) {
        await this.insertRevisionCreatedEntry(
          trx,
          personId,
          input.parent_task_id,
          taskId,
          input.title ?? existing.title,
        );
      }
    });

    return this.findById(personId, taskId, { includeRelations: true });
  }

  async delete(personId: number, taskId: number): Promise<boolean> {
    const task = await this.findRowById(personId, taskId);
    if (!task) return false;

    await db(Tables.TB_TASKS)
      .where({ id: taskId, person_id: personId })
      .del();

    return true;
  }

  /**
   * Riwayat aksi task, yang terbaru lebih dulu. Join `tb_tasks` untuk
   * `related_task_title` (judul task terkait, mis. child revisi) supaya FE bisa
   * merender link detail tanpa request tambahan.
   */
  async getHistory(taskId: number): Promise<TaskHistoryEntry[]> {
    return db(Tables.TB_TASK_HISTORY)
      .where(`${Tables.TB_TASK_HISTORY}.task_id`, taskId)
      .leftJoin(
        Tables.TB_TASKS,
        `${Tables.TB_TASK_HISTORY}.related_task_id`,
        `${Tables.TB_TASKS}.id`,
      )
      .orderBy(`${Tables.TB_TASK_HISTORY}.changed_at`, 'desc')
      .orderBy(`${Tables.TB_TASK_HISTORY}.id`, 'desc')
      .select<TaskHistoryEntry[]>([
        `${Tables.TB_TASK_HISTORY}.id as id`,
        `${Tables.TB_TASK_HISTORY}.action as action`,
        `${Tables.TB_TASK_HISTORY}.status as status`,
        `${Tables.TB_TASK_HISTORY}.notes as notes`,
        `${Tables.TB_TASK_HISTORY}.related_task_id as related_task_id`,
        `${Tables.TB_TASKS}.title as related_task_title`,
        `${Tables.TB_TASK_HISTORY}.changed_at as changed_at`,
      ]);
  }

  /** Anak/revisi dari sebuah task. */
  async getRevisions(personId: number, taskId: number): Promise<Task[]> {
    const rows = await db(Tables.TB_TASKS)
      .where({ person_id: personId, parent_task_id: taskId })
      .orderBy('created_at', 'asc')
      .select<TaskRow[]>('*');

    return this.hydrate(rows);
  }

  async addImage(taskId: number, url: string): Promise<void> {
    await db(Tables.TB_TASK_IMAGES).insert({
      task_id: taskId,
      url,
    });
  }

  /* ----------------------------- Todos ----------------------------- */

  async listTodos(taskId: number): Promise<TaskTodo[]> {
    const rows = await db(Tables.TB_TASK_TODOS)
      .where({ task_id: taskId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
      .select<TaskTodoRow[]>('*');
    return rows.map(toTaskTodo);
  }

  async findTodoById(
    taskId: number,
    todoId: number,
  ): Promise<TaskTodo | undefined> {
    if (!Number.isInteger(todoId)) return undefined;
    const row = await db(Tables.TB_TASK_TODOS)
      .where({ id: todoId, task_id: taskId })
      .first<TaskTodoRow>('*');
    return row ? toTaskTodo(row) : undefined;
  }

  async createTodo(
    taskId: number,
    input: TaskTodoCreateInput,
  ): Promise<TaskTodo> {
    const [maxRow] = await db(Tables.TB_TASK_TODOS)
      .where({ task_id: taskId })
      .max<Array<{ max_order: number | null }>>({ max_order: 'sort_order' });
    const nextOrder =
      maxRow?.max_order === null || maxRow?.max_order === undefined
        ? 0
        : Number(maxRow.max_order) + 1;

    const [id] = await db(Tables.TB_TASK_TODOS).insert({
      task_id: taskId,
      title: input.title,
      description: input.description ?? '',
      is_done: false,
      sort_order: nextOrder,
    });
    const row = await db(Tables.TB_TASK_TODOS)
      .where({ id })
      .first<TaskTodoRow>('*');
    return toTaskTodo(row!);
  }

  async updateTodo(
    taskId: number,
    todoId: number,
    patch: TaskTodoUpdateInput,
  ): Promise<TaskTodo | undefined> {
    const updateData: Record<string, unknown> = {};
    if (patch.title !== undefined) updateData.title = patch.title;
    if (patch.description !== undefined) {
      updateData.description = patch.description;
    }
    if (patch.is_done !== undefined) updateData.is_done = patch.is_done;

    if (Object.keys(updateData).length > 0) {
      updateData.updated_at = db.fn.now();
      await db(Tables.TB_TASK_TODOS)
        .where({ id: todoId, task_id: taskId })
        .update(updateData);
    }

    return this.findTodoById(taskId, todoId);
  }

  async deleteTodo(taskId: number, todoId: number): Promise<boolean> {
    const deleted = await db(Tables.TB_TASK_TODOS)
      .where({ id: todoId, task_id: taskId })
      .del();
    return deleted > 0;
  }

  /* --------------------------- Reordering --------------------------- */

  /** Id task milik user dari daftar id (untuk validasi ownership). */
  async findOwnedTaskIds(personId: number, ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];
    const rows = await db(Tables.TB_TASKS)
      .where({ person_id: personId })
      .whereIn('id', ids)
      .select<Array<{ id: number }>>('id');
    return rows.map((row) => row.id);
  }

  /** Set `sort_order` task sesuai urutan id yang dikirim. */
  async reorderTasks(personId: number, ids: number[]): Promise<void> {
    await db.transaction(async (trx) => {
      for (let index = 0; index < ids.length; index += 1) {
        await trx(Tables.TB_TASKS)
          .where({ id: ids[index], person_id: personId })
          .update({ sort_order: index });
      }
    });
  }

  async listDescriptions(taskId: number): Promise<TaskDescription[]> {
    const rows = await db(Tables.TB_TASK_DESCRIPTIONS)
      .where({ task_id: taskId })
      .orderBy('sort_order', 'asc')
      .orderBy('id', 'asc')
      .select<TaskDescriptionRow[]>(
        'id',
        'task_id',
        'title',
        'content',
        'sort_order',
        'created_at',
        'updated_at',
      );
    return rows.map(
      ({ id, title, content, sort_order, created_at, updated_at }) => ({
        id,
        title,
        content,
        sort_order,
        created_at,
        updated_at,
      }),
    );
  }

  async findDescriptionIds(taskId: number): Promise<number[]> {
    const rows = await db(Tables.TB_TASK_DESCRIPTIONS)
      .where({ task_id: taskId })
      .select<Array<{ id: number }>>('id');
    return rows.map((row) => row.id);
  }

  async reorderDescriptions(taskId: number, ids: number[]): Promise<void> {
    await db.transaction(async (trx) => {
      for (let index = 0; index < ids.length; index += 1) {
        await trx(Tables.TB_TASK_DESCRIPTIONS)
          .where({ id: ids[index], task_id: taskId })
          .update({ sort_order: index });
      }
    });
  }

  async findTodoIds(taskId: number): Promise<number[]> {
    const rows = await db(Tables.TB_TASK_TODOS)
      .where({ task_id: taskId })
      .select<Array<{ id: number }>>('id');
    return rows.map((row) => row.id);
  }

  async reorderTodos(taskId: number, ids: number[]): Promise<void> {
    await db.transaction(async (trx) => {
      for (let index = 0; index < ids.length; index += 1) {
        await trx(Tables.TB_TASK_TODOS)
          .where({ id: ids[index], task_id: taskId })
          .update({ sort_order: index });
      }
    });
  }

  private async findParentTask(personId: number, parentTaskId: number): Promise<Task | undefined> {
    const row = await this.findRowById(personId, parentTaskId);
    if (!row) return undefined;

    const [task] = await this.hydrate([row]);
    return task;
  }

  /** Ambil deskripsi, links, dan images sekaligus untuk sekumpulan task. */
  private async hydrate(rows: TaskRow[]): Promise<Task[]> {
    if (rows.length === 0) return [];

    const taskIds = rows.map((row) => row.id);
    const [descriptionRows, links, images] = await Promise.all([
      db(Tables.TB_TASK_DESCRIPTIONS)
        .whereIn('task_id', taskIds)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .select<TaskDescriptionRow[]>(
          'id',
          'task_id',
          'title',
          'content',
          'sort_order',
          'created_at',
          'updated_at',
        ),
      db(Tables.TB_TASK_LINKS)
        .whereIn('task_id', taskIds)
        .orderBy('id', 'asc')
        .select<TaskLinkRow[]>('*'),
      db(Tables.TB_TASK_IMAGES)
        .whereIn('task_id', taskIds)
        .orderBy('id', 'asc')
        .select<TaskImageRow[]>('*'),
    ]);

    const descriptionsByTask = groupByTaskId(descriptionRows);
    const linksByTask = groupByTaskId(links);
    const imagesByTask = groupByTaskId(images);

    return rows.map((row) =>
      toTask(
        row,
        (descriptionsByTask.get(row.id) ?? []).map(({ id, title, content, sort_order, created_at, updated_at }) => ({
          id,
          title,
          content,
          sort_order,
          created_at,
          updated_at,
        })),
        linksByTask.get(row.id) ?? [],
        imagesByTask.get(row.id) ?? [],
      ),
    );
  }

  private async insertDescriptions(
    trx: Knex.Transaction,
    taskId: number,
    descriptions: TaskDescriptionInput[],
  ): Promise<void> {
    await trx(Tables.TB_TASK_DESCRIPTIONS).insert(
      descriptions.map((description, index) => ({
        task_id: taskId,
        title: description.title,
        content: description.content,
        sort_order: index,
      })),
    );
  }

  /**
   * Deskripsi yang dikirim dengan `id` milik task ini di-update, yang tidak
   * dikirim lagi dihapus, sisanya di-insert sebagai entri baru. Mengembalikan
   * diff-nya supaya pemanggil bisa menulis entri history (tambah/ubah/hapus).
   */
  private async replaceDescriptions(
    trx: Knex.Transaction,
    taskId: number,
    descriptions: TaskDescriptionInput[],
  ): Promise<DescriptionDiff> {
    const existing = await trx(Tables.TB_TASK_DESCRIPTIONS)
      .where({ task_id: taskId })
      .select<DescriptionSnapshot[]>('id', 'title', 'content');

    const diff = diffDescriptions(existing, descriptions);

    if (diff.removed.length > 0) {
      await trx(Tables.TB_TASK_DESCRIPTIONS)
        .whereIn('id', diff.removed.map((row) => row.id))
        .del();
    }

    const [maxRow] = await trx(Tables.TB_TASK_DESCRIPTIONS)
      .where({ task_id: taskId })
      .max<Array<{ max_order: number | null }>>({ max_order: 'sort_order' });
    let nextOrder =
      maxRow?.max_order === null || maxRow?.max_order === undefined
        ? 0
        : Number(maxRow.max_order) + 1;

    for (const description of descriptions) {
      const descriptionId = description.id;

      if (typeof descriptionId === 'number' && diff.keptIds.has(descriptionId)) {
        await trx(Tables.TB_TASK_DESCRIPTIONS)
          .where({ id: descriptionId, task_id: taskId })
          .update({
            title: description.title,
            content: description.content,
            updated_at: trx.fn.now(),
          });
        continue;
      }

      await trx(Tables.TB_TASK_DESCRIPTIONS).insert({
        task_id: taskId,
        title: description.title,
        content: description.content,
        sort_order: nextOrder,
      });
      nextOrder += 1;
    }

    return diff;
  }

  /**
   * Entri `revision_created` di history task INDUK — `related_task_id` menunjuk
   * task anak, `notes` berisi judul anak (tetap terbaca walau anak dihapus,
   * karena FK-nya `ON DELETE SET NULL`). Status yang dicatat = status induk
   * saat kejadian (selalu `Merged` karena divalidasi service).
   */
  private async insertRevisionCreatedEntry(
    trx: Knex.Transaction,
    personId: number,
    parentTaskId: number,
    childTaskId: number,
    childTitle: string,
  ): Promise<void> {
    const parent = await trx(Tables.TB_TASKS)
      .where({ id: parentTaskId, person_id: personId })
      .first<{ status: string }>('status');

    // Induk hilang di tengah jalan (race) — jangan gagalkan task-nya.
    if (!parent) return;

    await trx(Tables.TB_TASK_HISTORY).insert({
      task_id: parentTaskId,
      action: 'revision_created',
      status: parent.status,
      notes: childTitle,
      related_task_id: childTaskId,
    });
  }

  private async replaceLinks(
    trx: Knex.Transaction,
    taskId: number,
    links: TaskLink[],
  ): Promise<void> {
    await trx(Tables.TB_TASK_LINKS).where({ task_id: taskId }).del();

    if (links.length === 0) return;

    await trx(Tables.TB_TASK_LINKS).insert(
      links.map((link) => ({
        task_id: taskId,
        type: link.type,
        url: link.url,
      })),
    );
  }
}

export const taskBoardRepository = new TaskBoardRepository();
