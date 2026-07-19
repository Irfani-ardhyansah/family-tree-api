import db from '../../config/database';
import { CreateAppLogInput } from './logs.types';

export class LogsRepository {
  async insert(input: CreateAppLogInput): Promise<number> {
    const [insertId] = await db('app_logs').insert({
      occurred_at: input.occurredAt ?? new Date(),
      category: input.category,
      action: input.action,
      status: input.status ?? 'success',
      actor_person_id: input.actorPersonId ?? null,
      family_id: input.familyId ?? null,
      resource_type: input.resourceType ?? null,
      resource_id: input.resourceId ?? null,
      http_method: input.httpMethod ?? null,
      path: input.path ?? null,
      http_status: input.httpStatus ?? null,
      message: input.message ?? null,
      metadata: input.metadata ?? null,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      request_id: input.requestId ?? null,
    });

    return Number(insertId);
  }
}

export const logsRepository = new LogsRepository();
