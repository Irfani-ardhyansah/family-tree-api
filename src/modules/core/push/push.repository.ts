import { createHash } from 'crypto';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { PushSubscriptionRow } from './push.types';

export function hashEndpoint(endpoint: string): string {
  return createHash('sha256').update(endpoint).digest('hex');
}

export class PushRepository {
  async upsert(input: {
    personId: number;
    familyId: number;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent: string | null;
  }): Promise<PushSubscriptionRow> {
    const endpointHash = hashEndpoint(input.endpoint);
    const existing = await db(Tables.PUSH_SUBSCRIPTIONS)
      .where({ endpoint_hash: endpointHash })
      .first<{ id: number }>('id');

    if (existing) {
      await db(Tables.PUSH_SUBSCRIPTIONS).where({ id: existing.id }).update({
        person_id: input.personId,
        family_id: input.familyId,
        endpoint: input.endpoint,
        endpoint_hash: endpointHash,
        p256dh: input.p256dh,
        auth: input.auth,
        user_agent: input.userAgent,
        last_seen_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
      const row = await this.findById(existing.id);
      return row!;
    }

    const [id] = await db(Tables.PUSH_SUBSCRIPTIONS).insert({
      person_id: input.personId,
      family_id: input.familyId,
      endpoint: input.endpoint,
      endpoint_hash: endpointHash,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
      last_seen_at: db.fn.now(),
    });

    const row = await this.findById(Number(id));
    return row!;
  }

  async findById(id: number): Promise<PushSubscriptionRow | undefined> {
    return db(Tables.PUSH_SUBSCRIPTIONS).where({ id }).first<PushSubscriptionRow>();
  }

  async findByEndpoint(endpoint: string): Promise<PushSubscriptionRow | undefined> {
    return db(Tables.PUSH_SUBSCRIPTIONS)
      .where({ endpoint_hash: hashEndpoint(endpoint) })
      .first<PushSubscriptionRow>();
  }

  async deleteByEndpointForPerson(personId: number, endpoint: string): Promise<number> {
    return db(Tables.PUSH_SUBSCRIPTIONS)
      .where({ person_id: personId, endpoint_hash: hashEndpoint(endpoint) })
      .delete();
  }

  async deleteById(id: number): Promise<number> {
    return db(Tables.PUSH_SUBSCRIPTIONS).where({ id }).delete();
  }

  async listByPersonIds(personIds: number[]): Promise<PushSubscriptionRow[]> {
    if (personIds.length === 0) {
      return [];
    }
    return db(Tables.PUSH_SUBSCRIPTIONS)
      .whereIn('person_id', personIds)
      .select<PushSubscriptionRow[]>('*');
  }
}

export const pushRepository = new PushRepository();
