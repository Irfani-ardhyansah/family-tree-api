export const LogCategory = {
  AUDIT: 'audit',
  NAVIGATION: 'navigation',
  AUTH: 'auth',
  SYSTEM: 'system',
  ERROR: 'error',
} as const;

export type LogCategory = (typeof LogCategory)[keyof typeof LogCategory];

export const LogStatus = {
  SUCCESS: 'success',
  FAILURE: 'failure',
} as const;

export type LogStatus = (typeof LogStatus)[keyof typeof LogStatus];

export type CreateAppLogInput = {
  category: LogCategory;
  action: string;
  status?: LogStatus;
  actorPersonId?: number | null;
  familyId?: number | null;
  resourceType?: string | null;
  resourceId?: number | null;
  httpMethod?: string | null;
  path?: string | null;
  httpStatus?: number | null;
  message?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  occurredAt?: Date;
};

export type TrackNavigationInput = {
  action: 'page.view' | 'click';
  path: string;
  label?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AppLogRow = {
  id: number;
  occurred_at: Date;
  category: LogCategory;
  action: string;
  status: LogStatus;
  actor_person_id: number | null;
  family_id: number | null;
  resource_type: string | null;
  resource_id: number | null;
  http_method: string | null;
  path: string | null;
  http_status: number | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
};
