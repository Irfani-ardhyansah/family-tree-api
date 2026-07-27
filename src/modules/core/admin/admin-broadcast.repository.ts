import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AdminBroadcastStatus, AdminBroadcastTarget, AdminUserOption, BroadcastRow } from './admin.types';

export class AdminBroadcastRepository {
  async listByFamily(familyId: number): Promise<BroadcastRow[]> {
    return db(Tables.BROADCASTS)
      .where({ family_id: familyId })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .select<BroadcastRow[]>('*');
  }

  async findById(familyId: number, id: number): Promise<BroadcastRow | undefined> {
    return db(Tables.BROADCASTS).where({ family_id: familyId, id }).first<BroadcastRow>();
  }

  async findDueScheduled(limit = 20): Promise<BroadcastRow[]> {
    return db(Tables.BROADCASTS)
      .where({ status: 'scheduled' })
      .whereNotNull('scheduled_at')
      .andWhere('scheduled_at', '<=', db.fn.now())
      .orderBy('scheduled_at', 'asc')
      .limit(limit)
      .select<BroadcastRow[]>('*');
  }

  async insert(input: {
    familyId: number;
    createdByPersonId: number;
    title: string;
    body: string;
    target: AdminBroadcastTarget;
    targetUserIds: number[];
    scheduledAt: Date | null;
    status: AdminBroadcastStatus;
    sentAt: Date | null;
  }): Promise<number> {
    const [id] = await db(Tables.BROADCASTS).insert({
      family_id: input.familyId,
      created_by_person_id: input.createdByPersonId,
      title: input.title,
      body: input.body,
      target: input.target,
      target_user_ids: JSON.stringify(input.targetUserIds),
      scheduled_at: input.scheduledAt,
      sent_at: input.sentAt,
      status: input.status,
    });
    return Number(id);
  }

  async markSent(id: number): Promise<void> {
    await db(Tables.BROADCASTS).where({ id }).update({
      status: 'sent',
      sent_at: db.fn.now(),
      error_message: null,
      updated_at: db.fn.now(),
    });
  }

  async markFailed(id: number, errorMessage: string): Promise<void> {
    await db(Tables.BROADCASTS).where({ id }).update({
      status: 'failed',
      error_message: errorMessage.slice(0, 512),
      updated_at: db.fn.now(),
    });
  }

  async listAliveMemberIds(familyId: number): Promise<number[]> {
    const rows = await db(`${Tables.PERSONS} as p`)
      .innerJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.family_id', familyId)
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .select<{ id: number }[]>('p.id');
    return rows.map((row) => row.id);
  }

  async filterAliveMemberIds(familyId: number, personIds: number[]): Promise<number[]> {
    if (personIds.length === 0) {
      return [];
    }
    const rows = await db(`${Tables.PERSONS} as p`)
      .innerJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.family_id', familyId)
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .whereIn('p.id', personIds)
      .select<{ id: number }[]>('p.id');
    return rows.map((row) => row.id);
  }

  async listUsersForBroadcast(familyId: number): Promise<AdminUserOption[]> {
    const rows = await db(`${Tables.PERSONS} as p`)
      .innerJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.family_id', familyId)
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .orderBy('p.full_name', 'asc')
      .select<{ id: number; full_name: string }[]>('p.id', 'p.full_name');

    return rows.map((row) => ({ id: row.id, name: row.full_name }));
  }

  async insertNotifications(
    rows: Array<{
      familyId: number;
      personId: number;
      broadcastId: number;
      title: string;
      body: string;
    }>,
  ): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    await db(Tables.NOTIFICATIONS).insert(
      rows.map((row) => ({
        family_id: row.familyId,
        person_id: row.personId,
        broadcast_id: row.broadcastId,
        title: row.title,
        body: row.body,
      })),
    );
  }

  async countAliveMembers(familyId: number): Promise<number> {
    const [row] = await db(`${Tables.PERSONS} as p`)
      .innerJoin(`${Tables.FAMILY_MEMBERS} as fm`, function joinMembers() {
        this.on('fm.person_id', '=', 'p.id').andOn('fm.family_id', '=', 'p.family_id');
      })
      .where('p.family_id', familyId)
      .where('p.status', 'alive')
      .whereNull('p.deleted_at')
      .count({ total: '*' });
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }
}

export const adminBroadcastRepository = new AdminBroadcastRepository();
