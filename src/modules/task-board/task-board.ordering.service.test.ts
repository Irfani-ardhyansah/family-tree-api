import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./task-board.repository', () => ({
  taskBoardRepository: {
    list: vi.fn(),
    findRowById: vi.fn(),
    findOwnedTaskIds: vi.fn(),
    reorderTasks: vi.fn(),
    findDescriptionIds: vi.fn(),
    reorderDescriptions: vi.fn(),
    listDescriptions: vi.fn(),
    findTodoIds: vi.fn(),
    reorderTodos: vi.fn(),
    listTodos: vi.fn(),
  },
}));

vi.mock('./task-board.workplace.repository', () => ({
  taskBoardWorkplaceRepository: { findById: vi.fn() },
}));

import { taskBoardRepository } from './task-board.repository';
import { taskBoardService } from './task-board.service';

const personId = 7;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('reorder list task', () => {
  it('menolak order kosong / bukan array', async () => {
    await expect(taskBoardService.reorder(personId, { order: [] })).rejects.toThrow(
      /order harus array id/,
    );
    await expect(taskBoardService.reorder(personId, {})).rejects.toThrow(
      /order harus array id/,
    );
  });

  it('menolak id duplikat', async () => {
    await expect(
      taskBoardService.reorder(personId, { order: [1, 1, 2] }),
    ).rejects.toThrow(/duplikat/);
  });

  it('menolak id yang bukan milik user', async () => {
    vi.mocked(taskBoardRepository.findOwnedTaskIds).mockResolvedValue([1, 2]);

    await expect(
      taskBoardService.reorder(personId, { order: [1, 2, 99] }),
    ).rejects.toThrow(/Task #99 tidak ditemukan/);
  });

  it('menyimpan urutan lalu mengembalikan list terbaru', async () => {
    vi.mocked(taskBoardRepository.findOwnedTaskIds).mockResolvedValue([1, 2]);
    vi.mocked(taskBoardRepository.reorderTasks).mockResolvedValue(undefined);
    vi.mocked(taskBoardRepository.list).mockResolvedValue([]);

    await taskBoardService.reorder(personId, { order: [2, 1] });

    expect(taskBoardRepository.reorderTasks).toHaveBeenCalledWith(personId, [2, 1]);
    expect(taskBoardRepository.list).toHaveBeenCalledWith(personId, {});
  });
});

describe('reorder penjelasan & todo', () => {
  beforeEach(() => {
    vi.mocked(taskBoardRepository.findRowById).mockResolvedValue({
      id: 11,
    } as never);
  });

  it('menolak order penjelasan yang tidak memuat semua id', async () => {
    vi.mocked(taskBoardRepository.findDescriptionIds).mockResolvedValue([1, 2, 3]);

    await expect(
      taskBoardService.reorderDescriptions(personId, 11, { order: [1, 2] }),
    ).rejects.toThrow(/tepat semua id penjelasan/);
  });

  it('menyimpan urutan penjelasan', async () => {
    vi.mocked(taskBoardRepository.findDescriptionIds).mockResolvedValue([1, 2]);
    vi.mocked(taskBoardRepository.listDescriptions).mockResolvedValue([]);

    await taskBoardService.reorderDescriptions(personId, 11, { order: [2, 1] });

    expect(taskBoardRepository.reorderDescriptions).toHaveBeenCalledWith(11, [2, 1]);
  });

  it('menyimpan urutan todo', async () => {
    vi.mocked(taskBoardRepository.findTodoIds).mockResolvedValue([5, 6]);
    vi.mocked(taskBoardRepository.listTodos).mockResolvedValue([]);

    await taskBoardService.reorderTodos(personId, 11, { order: [6, 5] });

    expect(taskBoardRepository.reorderTodos).toHaveBeenCalledWith(11, [6, 5]);
  });
});
