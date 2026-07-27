import {
  AdminAuditLogEntry,
  AdminAuditLogRow,
  AdminPagination,
  AdminSessionItem,
  ActiveSessionRow,
  ModuleStatusItem,
  ModuleStatusRow,
} from './admin.types';
import { AdminModuleId } from './admin.constants';

export function toIso(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function parseJsonObject(
  value: string | Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export function toModuleStatusItem(row: ModuleStatusRow): ModuleStatusItem {
  return {
    moduleId: row.module_id as AdminModuleId,
    enabled: Boolean(row.enabled),
    updatedAt: toIso(row.updated_at),
    updatedBy: row.updated_by_name,
  };
}

export function toAdminAuditLogEntry(row: AdminAuditLogRow): AdminAuditLogEntry {
  return {
    id: row.id,
    timestamp: toIso(row.occurred_at),
    userId: row.actor_person_id,
    userName: row.actor_name,
    moduleId: row.module_id,
    action: row.action,
    summary: row.summary,
    before: parseJsonObject(row.before),
    after: parseJsonObject(row.after),
  };
}

export function toAdminSessionItem(row: ActiveSessionRow, currentSessionId: number | null): AdminSessionItem {
  const loggedInAt = toIso(row.created_at);
  return {
    id: row.id,
    userId: row.person_id,
    userName: row.person_name,
    device: row.device?.trim() || 'Unknown',
    browser: row.browser?.trim() || 'Unknown',
    ipAddress: row.ip_address,
    loggedInAt,
    lastActiveAt: toIso(row.last_active_at ?? row.created_at),
    isCurrent: currentSessionId != null && row.id === currentSessionId,
  };
}

export function buildAdminPagination(page: number, pageSize: number, total: number): AdminPagination {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1 && totalPages > 0,
  };
}
