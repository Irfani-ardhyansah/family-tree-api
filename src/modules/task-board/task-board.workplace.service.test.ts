import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./task-board.workplace.repository', () => ({
  taskBoardWorkplaceRepository: {
    list: vi.fn(),
    findById: vi.fn(),
    countTasks: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    setArchived: vi.fn(),
    delete: vi.fn(),
  },
}));

import { taskBoardWorkplaceRepository } from './task-board.workplace.repository';
import { taskBoardWorkplaceService } from './task-board.workplace.service';
import type { Workplace } from './task-board.types';

const personId = 7;

function workplace(overrides: Partial<Workplace> = {}): Workplace {
  return {
    id: 1,
    person_id: personId,
    name: 'Nusantara Digital',
    employment_type: 'Fulltime',
    role: null,
    location: null,
    accent: null,
    started_at: null,
    ended_at: null,
    is_default: false,
    archived_at: null,
    created_at: '2026-10-09T00:00:00.000Z',
    updated_at: '2026-10-09T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('create workplace', () => {
  it('menolak tanpa nama', async () => {
    await expect(
      taskBoardWorkplaceService.create(personId, { employment_type: 'Fulltime' }),
    ).rejects.toThrow(/name wajib diisi/);
  });

  it('menolak employment_type asing', async () => {
    await expect(
      taskBoardWorkplaceService.create(personId, {
        name: 'X',
        employment_type: 'Bebas',
      }),
    ).rejects.toThrow(/employment_type/);
  });

  it('menormalkan input dan memanggil repository', async () => {
    vi.mocked(taskBoardWorkplaceRepository.create).mockResolvedValue(workplace());

    await taskBoardWorkplaceService.create(personId, {
      name: '  Nusantara Digital  ',
      employment_type: 'Fulltime',
      role: '  Frontend Engineer ',
      started_at: '2023-02-01',
    });

    expect(taskBoardWorkplaceRepository.create).toHaveBeenCalledWith(
      personId,
      expect.objectContaining({
        name: 'Nusantara Digital',
        employment_type: 'Fulltime',
        role: 'Frontend Engineer',
        started_at: '2023-02-01',
      }),
    );
  });
});

describe('archive / remove workplace', () => {
  it('menolak arsip tempat kerja default', async () => {
    vi.mocked(taskBoardWorkplaceRepository.findById).mockResolvedValue(
      workplace({ is_default: true }),
    );

    await expect(
      taskBoardWorkplaceService.archive(personId, 1),
    ).rejects.toThrow(/default tidak bisa diarsipkan/);
  });

  it('menolak hapus tempat kerja default', async () => {
    vi.mocked(taskBoardWorkplaceRepository.findById).mockResolvedValue(
      workplace({ is_default: true }),
    );

    await expect(taskBoardWorkplaceService.remove(personId, 1)).rejects.toThrow(
      /default tidak bisa dihapus/,
    );
  });

  it('menolak hapus tempat kerja yang masih punya task (409)', async () => {
    vi.mocked(taskBoardWorkplaceRepository.findById).mockResolvedValue(workplace());
    vi.mocked(taskBoardWorkplaceRepository.countTasks).mockResolvedValue(3);

    await expect(taskBoardWorkplaceService.remove(personId, 1)).rejects.toMatchObject({
      statusCode: 409,
      code: 'WORKPLACE_HAS_TASKS',
    });
  });

  it('menghapus tempat kerja kosong', async () => {
    vi.mocked(taskBoardWorkplaceRepository.findById).mockResolvedValue(workplace());
    vi.mocked(taskBoardWorkplaceRepository.countTasks).mockResolvedValue(0);
    vi.mocked(taskBoardWorkplaceRepository.delete).mockResolvedValue(true);

    await taskBoardWorkplaceService.remove(personId, 1);

    expect(taskBoardWorkplaceRepository.delete).toHaveBeenCalledWith(personId, 1);
  });

  it('404 kalau tempat kerja tidak ada', async () => {
    vi.mocked(taskBoardWorkplaceRepository.findById).mockResolvedValue(undefined);

    await expect(taskBoardWorkplaceService.remove(personId, 99)).rejects.toThrow(
      /Tempat kerja tidak ditemukan/,
    );
  });
});
