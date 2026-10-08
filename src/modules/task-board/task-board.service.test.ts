import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./task-board.repository', () => ({
  taskBoardRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    findRowById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    getHistory: vi.fn(),
    getRevisions: vi.fn(),
    addImage: vi.fn(),
    listTodos: vi.fn(),
    findTodoById: vi.fn(),
    createTodo: vi.fn(),
    updateTodo: vi.fn(),
    deleteTodo: vi.fn(),
  },
}));

import { taskBoardRepository } from './task-board.repository';
import { taskBoardService } from './task-board.service';
import type { Task } from './task-board.types';

const personId = 7;
const createdTask = { id: 11 } as Task;

/** Baris `tb_tasks` (tanpa relasi) untuk mengisi mock repository. */
type TaskRow = NonNullable<Awaited<ReturnType<typeof taskBoardRepository.findRowById>>>;

function taskRow(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: 5,
    person_id: personId,
    type: 'Feature',
    title: 'Task induk',
    branch_name: 'feature/induk',
    status: 'Merged',
    deploy_notes: null,
    migration_files: null,
    parent_task_id: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'Feature',
    title: 'Tambah filter',
    branchName: 'feature/filter',
    status: 'To-Do',
    descriptions: [{ title: 'Konteks', content: '<p>isi</p>' }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(undefined);
  vi.mocked(taskBoardRepository.create).mockResolvedValue(createdTask);
  vi.mocked(taskBoardRepository.update).mockResolvedValue(createdTask);
  vi.mocked(taskBoardRepository.getHistory).mockResolvedValue([]);
  vi.mocked(taskBoardRepository.getRevisions).mockResolvedValue([]);
});

describe('create task — deskripsi', () => {
  it('menolak create tanpa deskripsi', async () => {
    await expect(taskBoardService.create(personId, validBody({ descriptions: undefined }))).rejects.toThrow(
      /descriptions wajib diisi/,
    );
    expect(taskBoardRepository.create).not.toHaveBeenCalled();
  });

  it('menolak descriptions dan description dikirim bersamaan', async () => {
    await expect(
      taskBoardService.create(
        personId,
        validBody({ description: '<p>lama</p>' }),
      ),
    ).rejects.toThrow(/tidak boleh dikirim bersamaan/);
  });

  it('menerima description lama (string) sebagai satu entri deskripsi', async () => {
    const body = validBody({ descriptions: undefined, description: '<p>lama</p>' });

    await taskBoardService.create(personId, body);

    expect(taskBoardRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({
        descriptions: [{ title: 'Deskripsi', content: '<p>lama</p>' }],
      }),
    );
  });

  it('default status To-Do saat status tidak dikirim', async () => {
    await taskBoardService.create(personId, validBody({ status: undefined }));

    expect(taskBoardRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({ status: 'To-Do' }),
    );
  });

  it('menolak status "Done" dengan pesan pengganti "Merged"', async () => {
    await expect(taskBoardService.create(personId, validBody({ status: 'Done' }))).rejects.toThrow(
      /"Done" sudah tidak dipakai/,
    );
  });

  it('meneruskan notes sebagai entri history pertama', async () => {
    await taskBoardService.create(personId, validBody({ notes: 'Mulai dikerjakan' }));

    expect(taskBoardRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({ status_notes: 'Mulai dikerjakan' }),
    );
  });

  it('menormalkan migration_files (trim + buang duplikat)', async () => {
    await taskBoardService.create(
      personId,
      validBody({
        migration_files: [
          '20260929100000_alter_task_board_enhancements.ts',
          ' 20260929100000_alter_task_board_enhancements.ts ',
        ],
      }),
    );

    expect(taskBoardRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({
        migration_files: ['20260929100000_alter_task_board_enhancements.ts'],
      }),
    );
  });

  it.each([
    ['path file', 'src/database/migrations/20260929100000_x.ts'],
    ['ekstensi asing', 'migration.sql.txt'],
    ['kosong', '   '],
  ])('menolak migration_files dengan %s', async (_label, file) => {
    await expect(
      taskBoardService.create(personId, validBody({ migration_files: [file] })),
    ).rejects.toThrow(/migration_files/);
  });
});

describe('create task — revisi (parent/child)', () => {
  it('menerima revisi saat task induk berstatus Merged', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 5 }));

    await taskBoardService.create(personId, validBody({ parent_task_id: 5 }));

    expect(taskBoardRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({ parent_task_id: 5 }),
    );
  });

  it('menolak revisi saat task induk belum Merged', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(
      taskRow({ id: 5, status: 'In Progress' }),
    );

    await expect(
      taskBoardService.create(personId, validBody({ parent_task_id: 5 })),
    ).rejects.toThrow(/Revisi hanya boleh dibuat dari task berstatus "Merged"/);
  });

  it('menolak parent_task_id yang tidak ada / bukan milik user', async () => {
    await expect(
      taskBoardService.create(personId, validBody({ parent_task_id: 999 })),
    ).rejects.toThrow(/Task induk \(parent_task_id\) tidak ditemukan/);
  });

  it('menolak parent_task_id bukan angka', async () => {
    await expect(
      taskBoardService.create(personId, validBody({ parent_task_id: 'abc' })),
    ).rejects.toThrow(/parent_task_id harus id berupa angka positif/);
  });
});

describe('update task', () => {
  beforeEach(() => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11, status: 'To-Do' }));
  });

  it('404 kalau task tidak ada', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(undefined);

    await expect(taskBoardService.update(personId, 11, validBody())).rejects.toThrow(
      'Task tidak ditemukan.',
    );
  });

  it('menyimpan notes ke history saat status berubah', async () => {
    await taskBoardService.update(personId, 11, {
      status: 'In Progress',
      notes: 'MR sudah dibuka',
    });

    expect(taskBoardRepository.update).toHaveBeenCalledWith(
      personId,
      11,
      expect.objectContaining({ status: 'In Progress', status_notes: 'MR sudah dibuka' }),
    );
  });

  it('menerima statusNotes sebagai alias notes', async () => {
    await taskBoardService.update(personId, 11, { status: 'Merged', statusNotes: 'sudah merge' });

    expect(taskBoardRepository.update).toHaveBeenCalledWith(
      personId,
      11,
      expect.objectContaining({ status_notes: 'sudah merge' }),
    );
  });

  it('menolak descriptions array kosong', async () => {
    await expect(taskBoardService.update(personId, 11, { descriptions: [] })).rejects.toThrow(
      /descriptions minimal berisi satu entri/,
    );
  });

  it('menolak parent_task_id yang menunjuk task itu sendiri', async () => {
    await expect(taskBoardService.update(personId, 11, { parent_task_id: 11 })).rejects.toThrow(
      /tidak boleh menunjuk task itu sendiri/,
    );
  });

  it('melepas relasi revisi saat parent_task_id null', async () => {
    await taskBoardService.update(personId, 11, { parent_task_id: null });

    expect(taskBoardRepository.update).toHaveBeenCalledWith(
      personId,
      11,
      expect.objectContaining({ parent_task_id: null }),
    );
  });

  it('memperbarui migration_files dengan array kosong', async () => {
    await taskBoardService.update(personId, 11, { migration_files: [] });

    expect(taskBoardRepository.update).toHaveBeenCalledWith(
      personId,
      11,
      expect.objectContaining({ migration_files: [] }),
    );
  });
});

describe('history & revisions', () => {
  it('404 saat task tidak ditemukan', async () => {
    await expect(taskBoardService.getHistory(personId, 404)).rejects.toThrow('Task tidak ditemukan.');
    await expect(taskBoardService.getRevisions(personId, 404)).rejects.toThrow('Task tidak ditemukan.');
  });

  it('mengembalikan history task yang ada', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));
    vi.mocked(taskBoardRepository.getHistory).mockResolvedValue([
      {
        id: 2,
        action: 'status_changed',
        status: 'Merged',
        notes: null,
        related_task_id: null,
        related_task_title: null,
        changed_at: '2026-09-02T00:00:00.000Z',
      },
    ]);

    const history = await taskBoardService.getHistory(personId, 11);

    expect(history).toHaveLength(1);
    expect(taskBoardRepository.getHistory).toHaveBeenCalledWith(11);
  });

  it('mengembalikan revisi task yang ada', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));

    await taskBoardService.getRevisions(personId, 11);

    expect(taskBoardRepository.getRevisions).toHaveBeenCalledWith(personId, 11);
  });
});

describe('list task', () => {
  it('menolak filter status "Done"', async () => {
    await expect(taskBoardService.list(personId, { status: 'Done' as never })).rejects.toThrow(
      /"Done" sudah tidak dipakai/,
    );
  });

  it('meneruskan filter yang valid', async () => {
    vi.mocked(taskBoardRepository.list).mockResolvedValue([]);

    await taskBoardService.list(personId, { status: 'Merged', search: ' filter ' });

    expect(taskBoardRepository.list).toHaveBeenCalledWith(personId, {
      status: 'Merged',
      search: 'filter',
    });
  });
});

describe('todo task', () => {
  const todo = {
    id: 3,
    task_id: 11,
    title: 'Buat migrasi',
    description: '<p>detail</p>',
    is_done: false,
    created_at: '2026-10-08T00:00:00.000Z',
    updated_at: '2026-10-08T00:00:00.000Z',
  };

  it('404 saat task tidak ditemukan', async () => {
    await expect(taskBoardService.listTodos(personId, 404)).rejects.toThrow(
      'Task tidak ditemukan.',
    );
    await expect(
      taskBoardService.createTodo(personId, 404, { title: 'x' }),
    ).rejects.toThrow('Task tidak ditemukan.');
  });

  it('membuat todo dengan judul wajib dan deskripsi default kosong', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));
    vi.mocked(taskBoardRepository.createTodo).mockResolvedValue(todo);

    await taskBoardService.createTodo(personId, 11, { title: '  Buat migrasi  ' });

    expect(taskBoardRepository.createTodo).toHaveBeenCalledWith(11, {
      title: 'Buat migrasi',
      description: '',
    });
  });

  it('menolak todo tanpa judul', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));

    await expect(
      taskBoardService.createTodo(personId, 11, { title: '   ' }),
    ).rejects.toThrow(/title wajib diisi/);
  });

  it('update todo: hanya field yang dikirim + is_done boolean', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));
    vi.mocked(taskBoardRepository.updateTodo).mockResolvedValue({
      ...todo,
      is_done: true,
    });

    await taskBoardService.updateTodo(personId, 11, 3, { is_done: 1 });

    expect(taskBoardRepository.updateTodo).toHaveBeenCalledWith(11, 3, {
      is_done: true,
    });
  });

  it('update todo: deskripsi null dikosongkan', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));
    vi.mocked(taskBoardRepository.updateTodo).mockResolvedValue({
      ...todo,
      description: '',
    });

    await taskBoardService.updateTodo(personId, 11, 3, { description: null });

    expect(taskBoardRepository.updateTodo).toHaveBeenCalledWith(11, 3, {
      description: '',
    });
  });

  it('404 saat todo tidak ada di task', async () => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue(taskRow({ id: 11 }));
    vi.mocked(taskBoardRepository.updateTodo).mockResolvedValue(undefined);

    await expect(
      taskBoardService.updateTodo(personId, 11, 999, { is_done: true }),
    ).rejects.toThrow('Todo tidak ditemukan.');

    vi.mocked(taskBoardRepository.deleteTodo).mockResolvedValue(false);
    await expect(taskBoardService.deleteTodo(personId, 11, 999)).rejects.toThrow(
      'Todo tidak ditemukan.',
    );
  });
});

