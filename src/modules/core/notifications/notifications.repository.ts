import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { NotificationListQuery, NotificationRow } from './notifications.types';

const SELECT_COLS = [
  'id',
  'family_id',
  'person_id',
  'broadcast_id',
  'title',
  'body',
  'read_at',
  'created_at',
] as const;

export class NotificationsRepository {
  async countForPerson(personId: number, unreadOnly: boolean): Promise<number> {
    const query = db(Tables.NOTIFICATIONS).where({ person_id: personId }).count({ total: '*' });
    if (unreadOnly) {
      query.whereNull('read_at');
    }
    const [row] = await query;
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }

  async countUnread(personId: number): Promise<number> {
    return this.countForPerson(personId, true);
  }

  async listForPerson(personId: number, query: NotificationListQuery): Promise<NotificationRow[]> {
    const offset = (query.page - 1) * query.pageSize;
    const q = db(Tables.NOTIFICATIONS)
      .where({ person_id: personId })
      .select<NotificationRow[]>(...SELECT_COLS)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(query.pageSize)
      .offset(offset);

    if (query.unreadOnly) {
      q.whereNull('read_at');
    }

    return q;
  }

  async findOwned(personId: number, id: number): Promise<NotificationRow | undefined> {
    return db(Tables.NOTIFICATIONS)
      .where({ person_id: personId, id })
      .first<NotificationRow>(...SELECT_COLS);
  }

  async markRead(personId: number, id: number): Promise<number> {
    return db(Tables.NOTIFICATIONS)
      .where({ person_id: personId, id })
      .whereNull('read_at')
      .update({
        read_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
  }

  async markAllRead(personId: number): Promise<number> {
    return db(Tables.NOTIFICATIONS).where({ person_id: personId }).whereNull('read_at').update({
      read_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }
}

export const notificationsRepository = new NotificationsRepository();
