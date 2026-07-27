import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { toNotificationItem } from './notifications.mapper';
import { notificationsRepository } from './notifications.repository';
import {
  NotificationItem,
  NotificationListQuery,
  NotificationListResponse,
} from './notifications.types';

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

function parseUnreadOnly(value: unknown): boolean {
  if (value === true || value === 'true' || value === '1') {
    return true;
  }
  if (value === false || value === 'false' || value === '0' || value === undefined || value === '') {
    return false;
  }
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'unreadOnly harus true atau false.');
}

export class NotificationsService {
  parseListQuery(raw: Record<string, unknown>): NotificationListQuery {
    const page = parsePositiveInt(raw.page, 1);
    const pageSize = Math.min(parsePositiveInt(raw.pageSize, 20), 50);
    const unreadOnly = parseUnreadOnly(raw.unreadOnly);
    return { page, pageSize, unreadOnly };
  }

  async list(personId: number, rawQuery: Record<string, unknown>): Promise<NotificationListResponse> {
    const query = this.parseListQuery(rawQuery);
    const [total, unreadCount, rows] = await Promise.all([
      notificationsRepository.countForPerson(personId, query.unreadOnly),
      notificationsRepository.countUnread(personId),
      notificationsRepository.listForPerson(personId, query),
    ]);

    return {
      items: rows.map(toNotificationItem),
      page: query.page,
      pageSize: query.pageSize,
      total,
      unreadCount,
    };
  }

  async unreadCount(personId: number): Promise<{ unreadCount: number }> {
    const unreadCount = await notificationsRepository.countUnread(personId);
    return { unreadCount };
  }

  async markRead(personId: number, idRaw: string): Promise<NotificationItem> {
    const id = parsePositiveInt(idRaw, 0);
    if (id <= 0) {
      throw new AppError(404, ErrorCodes.NOTIFICATION_NOT_FOUND, 'Notifikasi tidak ditemukan.');
    }

    const existing = await notificationsRepository.findOwned(personId, id);
    if (!existing) {
      throw new AppError(404, ErrorCodes.NOTIFICATION_NOT_FOUND, 'Notifikasi tidak ditemukan.');
    }

    if (existing.read_at == null) {
      await notificationsRepository.markRead(personId, id);
    }

    const updated = await notificationsRepository.findOwned(personId, id);
    if (!updated) {
      throw new AppError(404, ErrorCodes.NOTIFICATION_NOT_FOUND, 'Notifikasi tidak ditemukan.');
    }

    return toNotificationItem(updated);
  }

  async markAllRead(personId: number): Promise<{ updated: number }> {
    const updated = await notificationsRepository.markAllRead(personId);
    return { updated };
  }
}

export const notificationsService = new NotificationsService();
