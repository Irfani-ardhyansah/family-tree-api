export type PushSubscriptionKeys = {
  p256dh: string;
  auth: string;
};

export type UpsertPushSubscriptionInput = {
  endpoint: string;
  keys: PushSubscriptionKeys;
  userAgent?: string | null;
};

export type PushSubscriptionRow = {
  id: number;
  person_id: number;
  family_id: number;
  endpoint: string;
  endpoint_hash: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  last_seen_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

export type PushPayload = {
  title: string;
  body: string;
  data?: {
    url?: string;
    type?: string;
    broadcastId?: number | null;
    notificationId?: number | null;
  };
};

export type VapidPublicKeyResponse = {
  publicKey: string;
  configured: boolean;
};
