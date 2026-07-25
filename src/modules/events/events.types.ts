import { ReadFocusMeta, PaginationMeta } from '../persons/persons.types';

export type EventType = 'wedding' | 'birth' | 'death' | 'birthday' | 'reunion' | 'other';

export type EventContribution = {
  id: number;
  photoUrl: string;
  contributorId: number;
  contributorName: string;
  caption: string | null;
  createdAt: string;
};

export type EventItem = {
  id: number;
  title: string;
  type: EventType;
  date: string;
  endDate: string | null;
  location: string | null;
  description: string | null;
  personIds: number[];
  photoUrls: string[];
  attendeeIds: number[];
  contributions: EventContribution[];
  isRestricted: boolean;
  canAccess: boolean;
  createdById: number;
  canManage: boolean;
};

export type EventListQuery = {
  type?: EventType;
  year?: number;
  month?: number;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  page: number;
  limit: number;
};

export type EventListResponse = ReadFocusMeta & {
  selfPersonId: number;
  events: EventItem[];
  pagination: PaginationMeta;
};

export type EventDetailResponse = ReadFocusMeta & {
  selfPersonId: number;
  event: EventItem;
};

export type UpsertEventInput = {
  title: string;
  type: EventType;
  date: string;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  personIds?: number[];
  photoUrls?: string[];
  mediaIds?: string[];
  attendeeIds?: number[];
};

export type CreateContributionInput = {
  photoUrl?: string;
  mediaId?: string;
  mediaIds?: string[];
  caption?: string | null;
};

export type EventRow = {
  id: number;
  family_id: number;
  title: string;
  type: EventType;
  date: Date | string;
  end_date: Date | string | null;
  location: string | null;
  description: string | null;
  created_by_person_id: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type ContributionRow = {
  id: number;
  event_id: number;
  contributor_person_id: number;
  photo_url: string;
  caption: string | null;
  created_at: Date;
  contributor_name: string;
};

export type EventPhotoRow = {
  id: number;
  event_id: number;
  photo_url: string;
  sort_order: number;
};
