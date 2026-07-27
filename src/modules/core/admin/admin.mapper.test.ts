import { describe, expect, it } from 'vitest';
import { buildAdminPagination, toModuleStatusItem } from './admin.mapper';

describe('admin.mapper', () => {
  it('builds pagination meta', () => {
    expect(buildAdminPagination(1, 20, 45)).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
      hasNext: true,
      hasPrev: false,
    });
  });

  it('maps module status row', () => {
    const item = toModuleStatusItem({
      id: 1,
      family_id: 1,
      module_id: 'money',
      enabled: 0,
      updated_by_person_id: 2,
      updated_by_name: 'Admin Irfan',
      updated_at: '2026-07-26T10:00:00.000Z',
      created_at: '2026-07-26T10:00:00.000Z',
    });

    expect(item).toEqual({
      moduleId: 'money',
      enabled: false,
      updatedAt: '2026-07-26T10:00:00.000Z',
      updatedBy: 'Admin Irfan',
    });
  });
});
