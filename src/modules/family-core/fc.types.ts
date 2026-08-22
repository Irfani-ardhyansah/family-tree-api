import type {
  CalendarEventIconKey,
  CalendarEventToneKey,
  DocumentExtraFieldDef,
  DocumentIconKey,
  DocumentToneKey,
  ReminderDays,
} from './fc.constants';

export type FcDocumentTypeRow = {
  id: number;
  family_id: number;
  slug: string;
  label: string;
  icon_key: string;
  tone_key: string;
  extras: string | DocumentExtraFieldDef[];
  default_lifetime: boolean | number;
  allow_custom_title: boolean | number;
  is_system: boolean | number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type FcDocumentTypeDto = {
  id: number;
  slug: string;
  label: string;
  iconKey: DocumentIconKey | string;
  toneKey: DocumentToneKey | string;
  extras: DocumentExtraFieldDef[];
  defaultLifetime: boolean;
  allowCustomTitle: boolean;
  isSystem: boolean;
  sortOrder: number;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type FcCalendarEventTypeRow = {
  id: number;
  family_id: number;
  slug: string;
  label: string;
  icon_key: string;
  tone_key: string;
  links_to_health: boolean | number;
  is_system: boolean | number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

export type FcCalendarEventTypeDto = {
  id: number;
  slug: string;
  label: string;
  iconKey: CalendarEventIconKey | string;
  toneKey: CalendarEventToneKey | string;
  linksToHealth: boolean;
  isSystem: boolean;
  sortOrder: number;
  canDelete: boolean;
  deleteBlockedReason: string | null;
};

export type FcDocumentStatus = 'active' | 'expiring_soon' | 'expired';

export type FcDocumentRow = {
  id: number;
  family_id: number;
  person_id: number;
  document_type_slug: string;
  custom_title: string | null;
  document_number_cipher: string;
  document_number_iv: string;
  issued_at: Date | string | null;
  expires_at: Date | string | null;
  is_lifetime: boolean | number;
  notes: string | null;
  extras: string | Record<string, string>;
  reminder_enabled: boolean | number;
  reminder_days: number | null;
  created_by_person_id: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type FcDocumentFileRow = {
  id: number;
  document_id: number;
  media_id: string;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  url?: string;
};

export type FcDocumentFileDto = {
  id: number;
  mediaId: string;
  url: string;
  sortOrder: number;
};

export type FcDocumentListItemDto = {
  id: number;
  personId: number;
  documentTypeSlug: string;
  title: string;
  numberMasked: string;
  issuedAt: string | null;
  expiresAt: string | null;
  isLifetime: boolean;
  status: FcDocumentStatus;
  daysUntilExpiry: number | null;
  reminderEnabled: boolean;
  reminderDays: ReminderDays | null;
  extras: Record<string, string>;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
};

export type FcDocumentDetailDto = FcDocumentListItemDto & {
  number: string;
  notes: string | null;
  customTitle: string | null;
  files: FcDocumentFileDto[];
  createdByPersonId: number;
};

export type FcDocumentReminderDto = {
  id: string;
  type: 'document_expiry';
  title: string;
  body: string;
  dueAt: string;
  relatedType: 'document';
  relatedId: number;
  link: string;
  status: FcDocumentStatus;
};

export type FcMemberDto = {
  personId: number;
  fullName: string;
  nickname: string | null;
  photoUrl: string | null;
  gender: string | null;
  kind: 'core' | 'in_law';
  relationLabel: string | null;
};

export type FcContext = {
  familyId: number;
  actorPersonId: number;
};
