import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../modules/core/auth/token.service', () => ({
  tokenService: { verifyAccessToken: vi.fn() },
}));

vi.mock('../../modules/core/auth/mcp-tokens/mcp-token.service', () => ({
  mcpTokenService: { verifyToken: vi.fn() },
}));

import { AppError } from '../errors/AppError';
import { tokenService } from '../../modules/core/auth/token.service';
import { mcpTokenService } from '../../modules/core/auth/mcp-tokens/mcp-token.service';
import { requireSessionAuth } from './requireAuth.middleware';

const verifyAccessToken = vi.mocked(tokenService.verifyAccessToken);
const verifyToken = vi.mocked(mcpTokenService.verifyToken);

function makeReq(authorization?: string): any {
  return { headers: authorization ? { authorization } : {} };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireSessionAuth', () => {
  it('accepts a session JWT', async () => {
    verifyAccessToken.mockReturnValue({ personId: 1, familyId: 2 } as any);

    const req = makeReq('Bearer eyJ.session.token');
    const next = vi.fn();

    await requireSessionAuth(req, {} as any, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.auth).toMatchObject({
      personId: 1,
      familyId: 2,
      authType: 'session',
    });
  });

  it('rejects an MCP token without setting req.auth', async () => {
    verifyToken.mockResolvedValue({
      tokenId: 10,
      personId: 1,
      familyId: 2,
      unlockModules: ['money'],
    });

    const req = makeReq('Bearer frmcp_test-token');
    const next = vi.fn();

    await requireSessionAuth(req, {} as any, next);

    const error = next.mock.calls[0]?.[0];
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(403);
    expect(req.auth).toBeUndefined();
  });
});
