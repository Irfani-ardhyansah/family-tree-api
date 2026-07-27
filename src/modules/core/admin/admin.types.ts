import {
  AdminAuditAction,
  AdminAuditModuleId,
  AdminModuleId,
} from './admin.constants';

export type { AdminModuleId };

export type AdminPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export type ModuleStatusItem = {
  moduleId: AdminModuleId;
  enabled: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

export type ModuleStatusListResponse = {
  items: ModuleStatusItem[];
};

export type ModuleStatusRow = {
  id: number;
  family_id: number;
  module_id: AdminModuleId;
  enabled: boolean | number;
  updated_by_person_id: number | null;
  updated_by_name: string | null;
  updated_at: Date | string;
  created_at: Date | string;
};

export type AdminAuditLogEntry = {
  id: number;
  timestamp: string;
  userId: number | null;
  userName: string | null;
  moduleId: AdminAuditModuleId | string;
  action: AdminAuditAction | string;
  summary: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

export type AdminAuditLogListResponse = {
  items: AdminAuditLogEntry[];
  pagination: AdminPagination;
};

export type AdminAuditLogQuery = {
  q?: string;
  userId?: number;
  moduleId?: string;
  action?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
};

export type AdminAuditLogRow = {
  id: number;
  family_id: number;
  actor_person_id: number | null;
  actor_name: string | null;
  module_id: string;
  action: string;
  summary: string;
  before: string | Record<string, unknown> | null;
  after: string | Record<string, unknown> | null;
  occurred_at: Date | string;
};

export type RecordAdminAuditInput = {
  familyId: number;
  actorPersonId: number | null;
  moduleId: AdminAuditModuleId | string;
  action: AdminAuditAction | string;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export type AdminSessionItem = {
  id: number;
  userId: number;
  userName: string;
  device: string;
  browser: string;
  ipAddress: string | null;
  loggedInAt: string;
  lastActiveAt: string;
  isCurrent: boolean;
};

export type AdminSessionListResponse = {
  items: AdminSessionItem[];
};

export type ActiveSessionRow = {
  id: number;
  person_id: number;
  family_id: number | null;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  created_at: Date | string;
  last_active_at: Date | string | null;
  person_name: string;
};

export type FamilyAccessRow = {
  id: number;
  access_version: number;
};

export type FamilySettingsRow = {
  id: number;
  name: string;
  timezone: string;
  currency: string;
  logo_url: string | null;
  access_version: number;
};

export type AdminSettings = {
  familyName: string;
  timezone: string;
  currency: string;
  logoUrl: string | null;
};

export type AdminBroadcastTarget = 'all' | 'selected';
export type AdminBroadcastStatus = 'sent' | 'scheduled' | 'failed';

export type AdminBroadcastItem = {
  id: number;
  title: string;
  body: string;
  target: AdminBroadcastTarget;
  targetUserIds: number[];
  targetLabel: string;
  scheduledAt: string | null;
  sentAt: string | null;
  status: AdminBroadcastStatus;
  createdAt: string;
};

export type AdminBroadcastListResponse = {
  items: AdminBroadcastItem[];
};

export type BroadcastRow = {
  id: number;
  family_id: number;
  created_by_person_id: number;
  title: string;
  body: string;
  target: AdminBroadcastTarget;
  target_user_ids: string | number[] | null;
  scheduled_at: Date | string | null;
  sent_at: Date | string | null;
  status: AdminBroadcastStatus;
  error_message: string | null;
  created_at: Date | string;
};

export type AdminUserOption = {
  id: number;
  name: string;
};

export type AdminUsersResponse = {
  items: AdminUserOption[];
};

export type AdminDashboardResponse = {
  userCount: number;
  activeSessionCount: number;
  modulesEnabled: number;
  modulesTotal: number;
  recentLogs: AdminAuditLogEntry[];
};

export type AdminBackupStatus = 'success' | 'failed' | 'running';

export type AdminBackupItem = {
  id: string;
  moduleIds: AdminModuleId[];
  createdAt: string;
  status: AdminBackupStatus;
  downloadUrl: string | null;
  errorMessage: string | null;
};

export type AdminBackupListResponse = {
  items: AdminBackupItem[];
};

export type BackupJobRow = {
  id: string;
  family_id: number;
  created_by_person_id: number;
  module_ids: string | string[];
  status: AdminBackupStatus;
  storage_key: string | null;
  error_message: string | null;
  created_at: Date | string;
  finished_at: Date | string | null;
};
