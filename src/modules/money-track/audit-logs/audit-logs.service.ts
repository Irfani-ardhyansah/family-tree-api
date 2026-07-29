import { moneyAccessRepository } from '../money-access.repository';
import {
  parseOptionalDateOnly,
  parseOptionalString,
  parsePage,
  parsePositiveInt,
  resolveMoneyContext,
  toIso,
} from '../money.access';
import type { MoneyAuditLogDto, MoneyPaginated } from '../money.types';
import { auditLogsRepository } from './audit-logs.repository';

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

export class AuditLogsService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPaginated<MoneyAuditLogDto>> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const { page, pageSize } = parsePage(query);
    const entityType = parseOptionalString(query.entityType, 'entityType', 40) ?? undefined;
    const entityId =
      query.entityId === undefined
        ? undefined
        : parsePositiveInt(query.entityId, 'entityId');
    const from = parseOptionalDateOnly(query.from, 'from') ?? undefined;
    const to = parseOptionalDateOnly(query.to, 'to') ?? undefined;

    const filters = {
      entityType: entityType ?? undefined,
      entityId,
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
      items: rows.map((row) => ({
        id: Number(row.id),
        actorPersonId: row.actor_person_id,
        actorName: nameMap.get(row.actor_person_id) ?? '',
        action: row.action,
        entityType: row.entity_type,
        entityId: Number(row.entity_id),
        before: parseJsonField(row.before),
        after: parseJsonField(row.after),
        createdAt: toIso(row.created_at) ?? '',
      })),
      page,
      pageSize,
      total,
    };
  }
}

export const auditLogsService = new AuditLogsService();
