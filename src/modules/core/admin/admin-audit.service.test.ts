import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./admin-audit.repository', () => ({
  adminAuditRepository: {
    insert: vi.fn(),
    countByFilters: vi.fn(),
    findByFilters: vi.fn(),
    findById: vi.fn(),
    findMoneyById: vi.fn(),
  },
}));

import { adminAuditRepository } from './admin-audit.repository';
import { adminAuditService } from './admin-audit.service';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminAuditRepository.countByFilters).mockResolvedValue(0);
  vi.mocked(adminAuditRepository.findByFilters).mockResolvedValue([]);
});

describe('admin audit — parseListQuery: sort', () => {
  it('default sort "desc" saat sort tidak dikirim', () => {
    const query = adminAuditService.parseListQuery({});

    expect(query.sort).toBe('desc');
  });

  it('menerima sort "asc"', () => {
    expect(adminAuditService.parseListQuery({ sort: 'asc' }).sort).toBe('asc');
  });

  it('menerima sort "desc"', () => {
    expect(adminAuditService.parseListQuery({ sort: 'desc' }).sort).toBe('desc');
  });

  it('trim spasi di sekitar sort', () => {
    expect(adminAuditService.parseListQuery({ sort: '  asc  ' }).sort).toBe('asc');
  });

  it('menolak sort di luar asc/desc dengan 422', () => {
    expect(() => adminAuditService.parseListQuery({ sort: 'foo' })).toThrow(
      /sort harus "asc" atau "desc"/,
    );
  });
});

describe('admin audit — list meneruskan sort', () => {
  it('mengirim filter sort "asc" ke repository', async () => {
    await adminAuditService.list(1, { sort: 'asc', page: '2', pageSize: '8' });

    expect(adminAuditRepository.findByFilters).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'asc', page: 2, pageSize: 8 }),
    );
    expect(adminAuditRepository.countByFilters).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'asc' }),
    );
  });

  it('default sort "desc" saat list tanpa sort', async () => {
    await adminAuditService.list(1, {});

    expect(adminAuditRepository.findByFilters).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ sort: 'desc' }),
    );
  });
});
