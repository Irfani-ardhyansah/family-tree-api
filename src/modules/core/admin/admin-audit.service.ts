import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { env } from '../../../config/env';
import { adminAuditRepository } from './admin-audit.repository';
import {
  isAdminAuditAction,
  isAdminAuditModuleId,
} from './admin.constants';
import { buildAdminPagination, toAdminAuditLogEntry } from './admin.mapper';
import {
  AdminAuditLogEntry,
  AdminAuditLogListResponse,
  AdminAuditLogQuery,
  RecordAdminAuditInput,
} from './admin.types';

function parsePositiveInt(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0) return n;
  }
  return fallback;
}

export class AdminAuditService {
  async record(input: RecordAdminAuditInput): Promise<void> {
    try {
      await adminAuditRepository.insert(input);
    } catch (error) {
      if (!env.isProduction) {
        console.error('[AdminAuditService] failed to persist audit log', error);
      }
    }
  }

  parseListQuery(query: Record<string, unknown>): AdminAuditLogQuery {
    const page = parsePositiveInt(query.page, 1);
    const pageSize = Math.min(parsePositiveInt(query.pageSize, 20), 100);

    const userIdRaw = query.userId;
    let userId: number | undefined;
    if (userIdRaw !== undefined && userIdRaw !== null && userIdRaw !== '') {
      const parsed = parsePositiveInt(userIdRaw, 0);
      if (parsed <= 0) {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'userId tidak valid.');
      }
      userId = parsed;
    }

    const moduleId = typeof query.moduleId === 'string' ? query.moduleId.trim() : undefined;
    if (moduleId && !isAdminAuditModuleId(moduleId)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'moduleId tidak valid.');
    }

    const action = typeof query.action === 'string' ? query.action.trim() : undefined;
    if (action && !isAdminAuditAction(action)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'action tidak valid.');
    }

    const from = typeof query.from === 'string' && query.from.trim() ? query.from.trim() : undefined;
    const to = typeof query.to === 'string' && query.to.trim() ? query.to.trim() : undefined;
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (from && !isoDate.test(from)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'from harus format YYYY-MM-DD.');
    }
    if (to && !isoDate.test(to)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'to harus format YYYY-MM-DD.');
    }

    const q = typeof query.q === 'string' && query.q.trim() ? query.q.trim() : undefined;

    return { q, userId, moduleId, action, from, to, page, pageSize };
  }

  async list(familyId: number, rawQuery: Record<string, unknown>): Promise<AdminAuditLogListResponse> {
    const filters = this.parseListQuery(rawQuery);
    const [total, rows] = await Promise.all([
      adminAuditRepository.countByFilters(familyId, filters),
      adminAuditRepository.findByFilters(familyId, filters),
    ]);

    return {
      items: rows.map(toAdminAuditLogEntry),
      pagination: buildAdminPagination(filters.page, filters.pageSize, total),
    };
  }

  async getById(familyId: number, idRaw: string): Promise<AdminAuditLogEntry> {
    const id = parsePositiveInt(idRaw, 0);
    if (id <= 0) {
      throw new AppError(404, ErrorCodes.ADMIN_AUDIT_NOT_FOUND, 'Audit log tidak ditemukan.');
    }

    const row = await adminAuditRepository.findById(familyId, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.ADMIN_AUDIT_NOT_FOUND, 'Audit log tidak ditemukan.');
    }

    return toAdminAuditLogEntry(row);
  }
}

export const adminAuditService = new AdminAuditService();
