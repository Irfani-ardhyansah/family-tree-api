import { NotificationItem, NotificationRow } from './notifications.types';

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function toNotificationItem(row: NotificationRow): NotificationItem {
  const readAt = toIso(row.read_at);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    type: 'broadcast',
    broadcastId: row.broadcast_id,
    isRead: readAt != null,
    readAt,
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
  };
}
