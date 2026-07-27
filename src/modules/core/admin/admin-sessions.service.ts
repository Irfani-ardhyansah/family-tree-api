import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { adminAuditService } from './admin-audit.service';
import { adminSessionsRepository } from './admin-sessions.repository';
import { toAdminSessionItem } from './admin.mapper';
import { AdminSessionListResponse } from './admin.types';

function parseOptionalPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0) return n;
  }
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'userId tidak valid.');
}

function parseSessionIdHeader(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !/^\d+$/.test(value.trim())) {
    return null;
  }
  return Number(value.trim());
}

function parsePathSessionId(raw: string): number {
  if (!/^\d+$/.test(raw)) {
    throw new AppError(404, ErrorCodes.ADMIN_SESSION_NOT_FOUND, 'Sesi tidak ditemukan.');
  }
  return Number(raw);
}

export class AdminSessionsService {
  async list(
    familyId: number,
    query: Record<string, unknown>,
    sessionIdHeader: string | undefined,
  ): Promise<AdminSessionListResponse> {
    const userId = parseOptionalPositiveInt(query.userId);
    const currentSessionId = parseSessionIdHeader(sessionIdHeader);
    const rows = await adminSessionsRepository.listActive(familyId, userId);
    return {
      items: rows.map((row) => toAdminSessionItem(row, currentSessionId)),
    };
  }

  async revoke(
    familyId: number,
    actorPersonId: number,
    sessionIdRaw: string,
    sessionIdHeader: string | undefined,
  ): Promise<{ revoked: true }> {
    const sessionId = parsePathSessionId(sessionIdRaw);
    const currentSessionId = parseSessionIdHeader(sessionIdHeader);

    if (currentSessionId != null && sessionId === currentSessionId) {
      throw new AppError(
        409,
        ErrorCodes.CANNOT_REVOKE_CURRENT_SESSION,
        'Tidak dapat memaksa logout sesi yang sedang dipakai.',
      );
    }

    const session = await adminSessionsRepository.findActiveById(familyId, sessionId);
    if (!session) {
      throw new AppError(404, ErrorCodes.ADMIN_SESSION_NOT_FOUND, 'Sesi tidak ditemukan.');
    }

    await adminSessionsRepository.revokeById(sessionId);

    await adminAuditService.record({
      familyId,
      actorPersonId,
      moduleId: 'admin',
      action: 'force_logout',
      summary: `Paksa logout sesi ${session.person_name}`,
      before: {
        sessionId,
        userId: session.person_id,
        device: session.device,
        browser: session.browser,
      },
      after: { revoked: true },
    });

    return { revoked: true };
  }
}

export const adminSessionsService = new AdminSessionsService();
