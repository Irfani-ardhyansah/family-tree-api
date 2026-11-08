import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./mcp-token.repository', () => ({
  mcpTokenRepository: {
    countActiveByPerson: vi.fn(),
    insert: vi.fn(),
    listByPerson: vi.fn(),
    findOwned: vi.fn(),
    revokeById: vi.fn(),
    findActiveByHash: vi.fn(),
    touchLastUsed: vi.fn(),
    listByFamily: vi.fn(),
    findInFamily: vi.fn(),
  },
}));

vi.mock('../../admin/admin-audit.service', () => ({
  adminAuditService: { record: vi.fn() },
}));

vi.mock('../token.service', () => ({
  tokenService: { verifyModuleUnlock: vi.fn() },
}));

import type { ModuleUnlockPayload } from '../token.service';
import { tokenService } from '../token.service';
import { mcpTokenRepository } from './mcp-token.repository';
import { mcpTokenService } from './mcp-token.service';

const countActive = vi.mocked(mcpTokenRepository.countActiveByPerson);
const insert = vi.mocked(mcpTokenRepository.insert);
const verifyUnlock = vi.mocked(tokenService.verifyModuleUnlock);

type InsertInput = Parameters<typeof mcpTokenRepository.insert>[0];

function makeRow(input: InsertInput) {
  return {
    id: 1,
    family_id: input.familyId,
    person_id: input.personId,
    label: input.label,
    token_hash: input.tokenHash,
    token_hint: input.tokenHint,
    unlock_modules: JSON.stringify(input.unlockModules),
    last_used_at: null,
    expires_at: null,
    revoked_at: null,
    created_at: '2026-11-08T00:00:00.000Z',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  countActive.mockResolvedValue(0);
  insert.mockImplementation(async (input) => makeRow(input));
});

describe('McpTokenService.create', () => {
  it('memberi Money Track otomatis tanpa password kedua', async () => {
    const result = await mcpTokenService.create(
      1,
      2,
      { label: 'Nouride', modules: [] },
      undefined,
    );

    expect(verifyUnlock).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0].unlockModules).toEqual([]);
    expect(result.item.unlocks).toEqual(['money']);
  });

  it('mengabaikan money di modules dan tidak butuh unlock header', async () => {
    const result = await mcpTokenService.create(
      1,
      2,
      { label: 'Nouride', modules: ['money'] },
      undefined,
    );

    expect(verifyUnlock).not.toHaveBeenCalled();
    expect(insert.mock.calls[0][0].unlockModules).toEqual([]);
    expect(result.item.unlocks).toEqual(['money']);
  });

  it('menyimpan modul opsional kalau unlock valid', async () => {
    verifyUnlock.mockReturnValue({ personId: 1, familyId: 2, modules: ['core'] } satisfies ModuleUnlockPayload);

    const result = await mcpTokenService.create(
      1,
      2,
      { label: 'Nouride', modules: ['money', 'core'] },
      'unlock-token',
    );

    expect(verifyUnlock).toHaveBeenCalledWith('unlock-token');
    expect(insert.mock.calls[0][0].unlockModules).toEqual(['core']);
    expect(result.item.unlocks).toEqual(['money', 'core']);
  });

  it('menolak modul opsional tanpa unlock header', async () => {
    await expect(
      mcpTokenService.create(1, 2, { label: 'Nouride', modules: ['core'] }, undefined),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SECONDARY_UNLOCK_REQUIRED',
    });
    expect(insert).not.toHaveBeenCalled();
  });
});
