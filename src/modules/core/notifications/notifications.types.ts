export type NotificationType = 'broadcast';

export type NotificationItem = {
  id: number;
  title: string;
  body: string;
  type: NotificationType;
  broadcastId: number | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationListResponse = {
  items: NotificationItem[];
  page: number;
  pageSize: number;
  total: number;
  unreadCount: number;
};

export type NotificationListQuery = {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
};

export type NotificationRow = {
  id: number;
  family_id: number;
  person_id: number;
  broadcast_id: number | null;
  title: string;
  body: string;
  read_at: Date | string | null;
  created_at: Date | string;
};
