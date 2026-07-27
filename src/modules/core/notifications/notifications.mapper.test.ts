import { describe, expect, it } from 'vitest';
import { toNotificationItem } from './notifications.mapper';

describe('toNotificationItem', () => {
  it('maps unread notification', () => {
    const item = toNotificationItem({
      id: 1,
      family_id: 1,
      person_id: 83,
      broadcast_id: 12,
      title: 'Gathering Sabtu',
      body: '<p>Halo</p>',
      read_at: null,
      created_at: '2026-07-27T10:00:00.000Z',
    });

    expect(item).toEqual({
      id: 1,
      title: 'Gathering Sabtu',
      body: '<p>Halo</p>',
      type: 'broadcast',
      broadcastId: 12,
      isRead: false,
      readAt: null,
      createdAt: '2026-07-27T10:00:00.000Z',
    });
  });

  it('maps read notification', () => {
    const item = toNotificationItem({
      id: 2,
      family_id: 1,
      person_id: 83,
      broadcast_id: null,
      title: 'Info',
      body: 'x',
      read_at: '2026-07-27T11:00:00.000Z',
      created_at: '2026-07-27T10:00:00.000Z',
    });

    expect(item.isRead).toBe(true);
    expect(item.readAt).toBe('2026-07-27T11:00:00.000Z');
    expect(item.broadcastId).toBeNull();
  });
});
