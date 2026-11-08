import crypto from 'crypto';
import { AppError } from '../../../../shared/errors/AppError';
import { ErrorCodes } from '../../../../shared/errors/errorCodes';
import {
  MCP_DEFAULT_MODULES,
  MCP_OPTIONAL_MODULES,
  MCP_TOKEN_DEFAULT_LABEL,
  MCP_TOKEN_LABEL_MAX,
  MCP_TOKEN_PREFIX,
  McpUnlockModule,
  isMcpDefaultModule,
  isMcpUnlockModule,
} from './mcp-token.constants';
import { McpTokenItem, McpTokenRow } from './mcp-token.types';

export function generateMcpToken(): string {
  return `${MCP_TOKEN_PREFIX}${crypto.randomBytes(32).toString('base64url')}`;
}

export function hashMcpToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function buildMcpTokenHint(token: string): string {
  if (token.length <= 16) {
    return token;
  }
  return `${token.slice(0, 12)}...${token.slice(-4)}`;
}

export function parseMcpTokenLabel(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return MCP_TOKEN_DEFAULT_LABEL;
  }
  if (typeof raw !== 'string') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'label harus berupa teks.');
  }

  const label = raw.trim();
  if (label.length === 0) {
    return MCP_TOKEN_DEFAULT_LABEL;
  }
  if (label.length > MCP_TOKEN_LABEL_MAX) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `label maksimal ${MCP_TOKEN_LABEL_MAX} karakter.`,
    );
  }

  return label;
}

/**
 * `undefined` = tidak dikirim → tidak ada modul opsional (Money Track tetap otomatis).
 * `null` / array kosong = tidak ada modul opsional.
 */
export function parseMcpUnlockModules(raw: unknown): McpUnlockModule[] | null {
  if (raw === undefined) {
    return null;
  }
  if (raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'modules harus berupa array.');
  }

  const result: McpUnlockModule[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'modules hanya boleh berisi teks.');
    }

    const moduleId = item.trim().toLowerCase();
    if (moduleId === 'admin') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Modul admin tidak boleh diberikan ke token MCP.',
      );
    }
    if (!isMcpUnlockModule(moduleId)) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `Modul tidak valid: ${item}. Pilihan opsional: ${MCP_OPTIONAL_MODULES.join(', ')}. Money Track otomatis.`,
      );
    }
    if (!result.includes(moduleId)) {
      result.push(moduleId);
    }
  }

  return result;
}

export function parseStoredUnlockModules(raw: unknown): McpUnlockModule[] {
  if (raw == null) {
    return [];
  }

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed.filter((item): item is McpUnlockModule => {
    return typeof item === 'string' && isMcpUnlockModule(item);
  });
}

/**
 * Modul efektif token: default (Money Track) + modul opsional yang tersimpan.
 * Dipakai saat verifikasi token dan saat menampilkan item ke user/admin.
 */
export function effectiveUnlockModules(stored: McpUnlockModule[]): McpUnlockModule[] {
  const result: McpUnlockModule[] = [...MCP_DEFAULT_MODULES];
  for (const moduleId of stored) {
    if (!result.includes(moduleId)) {
      result.push(moduleId);
    }
  }
  return result;
}

/** Buang modul default; sisakan modul yang benar-benar perlu unlock/checkbox. */
export function optionalUnlockModules(modules: McpUnlockModule[]): McpUnlockModule[] {
  return modules.filter((moduleId) => !isMcpDefaultModule(moduleId));
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function isMcpTokenActive(row: McpTokenRow, now = new Date()): boolean {
  if (row.revoked_at != null) {
    return false;
  }
  if (row.expires_at == null) {
    return true;
  }
  const expiresAt = row.expires_at instanceof Date ? row.expires_at : new Date(row.expires_at);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime();
}

export function toMcpTokenItem(row: McpTokenRow): McpTokenItem {
  return {
    id: Number(row.id),
    label: row.label,
    tokenHint: row.token_hint,
    unlocks: effectiveUnlockModules(parseStoredUnlockModules(row.unlock_modules)),
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    lastUsedAt: toIso(row.last_used_at),
    expiresAt: toIso(row.expires_at),
    revokedAt: toIso(row.revoked_at),
    isActive: isMcpTokenActive(row),
  };
}
