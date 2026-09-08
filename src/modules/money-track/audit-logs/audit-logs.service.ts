import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  parseOptionalDateOnly,
  parseOptionalEnum,
  parseOptionalString,
  parsePage,
  parsePositiveInt,
  resolveMoneyContext,
  toIso,
} from '../money.access';
import { MONEY_AUDIT_ENTITY_TYPE_FILTERS } from '../money.constants';
import type { MoneyAuditLogDto, MoneyAuditLogRow, MoneyPaginated } from '../money.types';
import { auditLogsRepository } from './audit-logs.repository';

const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const;

function parseJsonField(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function toDto(
  row: MoneyAuditLogRow,
  nameMap: Map<number, string>,
): MoneyAuditLogDto {
  return {
    id: String(row.id),
    createdAt: toIso(row.created_at) ?? '',
    actorPersonId: row.actor_person_id,
    actorName: nameMap.get(row.actor_person_id) ?? '',
    action: row.action,
    entityType: row.entity_type,
    entityId: String(row.entity_id),
    summary: row.summary || '(tanpa ringkasan)',
    before: parseJsonField(row.before),
    after: parseJsonField(row.after),
  };
}

export class AuditLogsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPaginated<MoneyAuditLogDto>> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const { page, pageSize } = parsePage(query);
    const q = parseOptionalString(query.q, 'q', 120) ?? undefined;
    const actorPersonId =
      query.actorPersonId === undefined
        ? undefined
        : parsePositiveInt(query.actorPersonId, 'actorPersonId');
    const entityType = parseOptionalEnum(
      query.entityType,
      'entityType',
      MONEY_AUDIT_ENTITY_TYPE_FILTERS,
    );
    const entityId =
      query.entityId === undefined || query.entityId === ''
        ? undefined
        : typeof query.entityId === 'string' && /^\d+$/.test(query.entityId)
          ? Number(query.entityId)
          : parsePositiveInt(query.entityId, 'entityId');
    const action = parseOptionalEnum(query.action, 'action', AUDIT_ACTIONS);
    const from = parseOptionalDateOnly(query.from, 'from') ?? undefined;
    const to = parseOptionalDateOnly(query.to, 'to') ?? undefined;

    if (actorPersonId != null) {
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        actorPersonId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }

    const filters = {
      q,
      actorPersonId,
      entityType: entityType ?? undefined,
      entityId,
      action: action ?? undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      page,
      pageSize,
    };

    const [total, rows] = await Promise.all([
      auditLogsRepository.count(ctx.workspace.id, filters),
      auditLogsRepository.list(ctx.workspace.id, filters),
    ]);

    const persons = await moneyAccessRepository.listPersons(ctx.workspace.id);
    const nameMap = new Map(persons.map((p) => [p.id, p.name]));

    return {
      items: rows.map((row) => toDto(row, nameMap)),
      page,
      pageSize,
      total,
    };
  }

  async getById(
    authPersonId: number,
    familyId: number,
    idRaw: string,
  ): Promise<MoneyAuditLogDto> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const id = parsePositiveInt(idRaw, 'id');
    const row = await auditLogsRepository.findById(ctx.workspace.id, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.NOT_FOUND, 'Audit log tidak ditemukan.');
    }
    const persons = await moneyAccessRepository.listPersons(ctx.workspace.id);
    const nameMap = new Map(persons.map((p) => [p.id, p.name]));
    return toDto(row, nameMap);
  }
}

export const auditLogsService = new AuditLogsService();
