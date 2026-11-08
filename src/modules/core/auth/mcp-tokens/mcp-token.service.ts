import { AppError } from '../../../../shared/errors/AppError';
import { ErrorCodes } from '../../../../shared/errors/errorCodes';
import { adminAuditService } from '../../admin/admin-audit.service';
import { tokenService } from '../token.service';
import {
  MCP_TOKEN_MAX_ACTIVE,
  McpUnlockModule,
  isMcpUnlockModule,
} from './mcp-token.constants';
import {
  buildMcpTokenHint,
  generateMcpToken,
  hashMcpToken,
  parseMcpTokenLabel,
  parseMcpUnlockModules,
  parseStoredUnlockModules,
  toMcpTokenItem,
} from './mcp-token.helpers';
import { mcpTokenRepository } from './mcp-token.repository';
import {
  AdminMcpTokenItem,
  AdminMcpTokenListResponse,
  CreateMcpTokenResponse,
  McpTokenAuthContext,
  McpTokenListResponse,
  McpTokenRow,
  McpTokenStatusFilter,
  RevokeMcpTokenResult,
} from './mcp-token.types';

function readUnlockHeader(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.trim()) {
    return null;
  }
  return value.trim();
}

function verifyUnlockHeader(
  raw: string | string[] | undefined,
  personId: number,
  familyId: number,
): { modules: McpUnlockModule[] } | null {
  const token = readUnlockHeader(raw);
  if (!token) {
    return null;
  }

  let payload;
  try {
    payload = tokenService.verifyModuleUnlock(token);
  } catch {
    throw new AppError(
      403,
      ErrorCodes.SECONDARY_UNLOCK_INVALID,
      'Token unlock tidak valid atau kedaluwarsa. Verifikasi ulang password kedua.',
    );
  }

  if (payload.personId !== personId || payload.familyId !== familyId) {
    throw new AppError(
      403,
      ErrorCodes.SECONDARY_UNLOCK_INVALID,
      'Token unlock tidak cocok dengan sesi saat ini.',
    );
  }

  return {
    modules: payload.modules.filter(isMcpUnlockModule),
  };
}

function parseTokenId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new AppError(404, ErrorCodes.MCP_TOKEN_NOT_FOUND, 'Token MCP tidak ditemukan.');
  }
  const id = Number(raw);
  if (id <= 0) {
    throw new AppError(404, ErrorCodes.MCP_TOKEN_NOT_FOUND, 'Token MCP tidak ditemukan.');
  }
  return id;
}

function parseOptionalPositiveInt(raw: unknown, field: string): number | undefined {
  if (raw === undefined || raw === null || raw === '') {
    return undefined;
  }
  if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
    return raw;
  }
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    const value = Number(raw);
    if (value > 0) {
      return value;
    }
  }
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} tidak valid.`);
}

function parseStatus(raw: unknown): McpTokenStatusFilter {
  if (raw === undefined || raw === null || raw === '') {
    return 'active';
  }
  if (typeof raw !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'status tidak valid.');
  }
  const status = raw.trim().toLowerCase();
  if (status === 'active' || status === 'revoked' || status === 'all') {
    return status;
  }
  throw new AppError(
    422,
    ErrorCodes.VALIDATION_ERROR,
    'status harus active, revoked, atau all.',
  );
}

function toAdminItem(row: McpTokenRow | undefined): AdminMcpTokenItem {
  if (!row) {
    throw new AppError(404, ErrorCodes.MCP_TOKEN_NOT_FOUND, 'Token MCP tidak ditemukan.');
  }
  return {
    ...toMcpTokenItem(row),
    personId: Number(row.person_id),
    personName: row.person_name ?? '',
  };
}

export class McpTokenService {
  async create(
    personId: number,
    familyId: number,
    body: unknown,
    unlockHeader: string | string[] | undefined,
  ): Promise<CreateMcpTokenResponse> {
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const label = parseMcpTokenLabel(record.label);
    const requested = parseMcpUnlockModules(record.modules);
    const unlock = verifyUnlockHeader(unlockHeader, personId, familyId);

    let unlockModules: McpUnlockModule[];
    if (requested === null) {
      unlockModules = unlock ? unlock.modules : [];
    } else {
      if (requested.length > 0) {
        if (!unlock) {
          throw new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_REQUIRED,
            'Verifikasi password kedua diperlukan untuk memberi akses modul ke token MCP.',
          );
        }
        const missing = requested.filter((moduleId) => !unlock.modules.includes(moduleId));
        if (missing.length > 0) {
          throw new AppError(
            403,
            ErrorCodes.SECONDARY_UNLOCK_REQUIRED,
            `Unlock untuk modul ${missing.join(', ')} tidak ada. Verifikasi password kedua ulang.`,
          );
        }
      }
      unlockModules = requested;
    }

    const activeCount = await mcpTokenRepository.countActiveByPerson(personId);
    if (activeCount >= MCP_TOKEN_MAX_ACTIVE) {
      throw new AppError(
        409,
        ErrorCodes.MCP_TOKEN_LIMIT_REACHED,
        `Maksimal ${MCP_TOKEN_MAX_ACTIVE} token MCP aktif. Hapus token lama dulu.`,
      );
    }

    const token = generateMcpToken();
    const row = await mcpTokenRepository.insert({
      familyId,
      personId,
      label,
      tokenHash: hashMcpToken(token),
      tokenHint: buildMcpTokenHint(token),
      unlockModules,
    });

    return {
      token,
      item: toMcpTokenItem(row),
    };
  }

  async listOwn(personId: number): Promise<McpTokenListResponse> {
    const rows = await mcpTokenRepository.listByPerson(personId);
    return {
      items: rows.map((row) => toMcpTokenItem(row)),
    };
  }

  async revokeOwn(personId: number, idRaw: string): Promise<RevokeMcpTokenResult> {
    const id = parseTokenId(idRaw);
    const row = await mcpTokenRepository.findOwned(personId, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.MCP_TOKEN_NOT_FOUND, 'Token MCP tidak ditemukan.');
    }

    const alreadyRevoked = row.revoked_at != null;
    if (!alreadyRevoked) {
      await mcpTokenRepository.revokeById(id);
      row.revoked_at = new Date();
    }

    return {
      revoked: true,
      alreadyRevoked,
      item: toMcpTokenItem(row),
    };
  }

  async verifyToken(rawToken: string): Promise<McpTokenAuthContext> {
    const row = await mcpTokenRepository.findActiveByHash(hashMcpToken(rawToken));
    if (!row) {
      throw new AppError(
        401,
        ErrorCodes.MCP_TOKEN_INVALID,
        'Token MCP tidak valid, sudah dicabut, atau kedaluwarsa.',
      );
    }

    // Best-effort: jangan gagalkan autentikasi hanya karena update last_used gagal.
    void mcpTokenRepository.touchLastUsed(Number(row.id)).catch(() => undefined);

    return {
      tokenId: Number(row.id),
      personId: Number(row.person_id),
      familyId: Number(row.family_id),
      unlockModules: parseStoredUnlockModules(row.unlock_modules),
    };
  }

  async listFamily(
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<AdminMcpTokenListResponse> {
    const rows = await mcpTokenRepository.listByFamily(familyId, {
      personId: parseOptionalPositiveInt(query.personId, 'personId'),
      status: parseStatus(query.status),
    });

    return {
      items: rows.map((row) => toAdminItem(row)),
    };
  }

  async revokeByAdmin(
    familyId: number,
    actorPersonId: number,
    idRaw: string,
  ): Promise<RevokeMcpTokenResult> {
    const id = parseTokenId(idRaw);
    const row = await mcpTokenRepository.findInFamily(familyId, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.MCP_TOKEN_NOT_FOUND, 'Token MCP tidak ditemukan.');
    }

    const alreadyRevoked = row.revoked_at != null;
    if (!alreadyRevoked) {
      await mcpTokenRepository.revokeById(id);
      row.revoked_at = new Date();

      await adminAuditService.record({
        familyId,
        actorPersonId,
        moduleId: 'admin',
        action: 'delete',
        summary: `Cabut paksa token MCP ${row.person_name ?? ''} "${row.label}"`,
        before: {
          tokenId: Number(row.id),
          personId: Number(row.person_id),
          label: row.label,
          tokenHint: row.token_hint,
        },
        after: { revoked: true },
      });
    }

    return {
      revoked: true,
      alreadyRevoked,
      item: toAdminItem(row),
    };
  }
}

export const mcpTokenService = new McpTokenService();
