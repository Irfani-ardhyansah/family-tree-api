import { ReadFocusMeta } from '../persons/persons.types';

export type DeceasedListItem = {
  id: number;
  fullName: string;
  nickname: string | null;
  gender: 'male' | 'female';
  birthDate: string;
  deathDate: string | null;
  status: 'deceased';
  photoUrl: string | null;
  generationLabel: string;
  religion: 'islam' | 'other' | null;
  tributeCount: number;
  prayerCount: number;
};

export type DeceasedListResponse = ReadFocusMeta & {
  selfPersonId: number;
  deceased: DeceasedListItem[];
};

export type DeceasedDetailResponse = ReadFocusMeta & {
  selfPersonId: number;
  deceased: DeceasedListItem;
};

export type TributeItem = {
  id: number;
  content: string;
  authorId: number;
  authorName: string;
  photoUrls: string[];
  createdAt: string;
  updatedAt: string | null;
};

export type TributeListResponse = ReadFocusMeta & {
  selfPersonId: number;
  tributes: TributeItem[];
};

export type PrayerItem = {
  id: number;
  authorId: number;
  authorName: string;
  createdAt: string;
};

export type PrayerListResponse = ReadFocusMeta & {
  selfPersonId: number;
  prayers: PrayerItem[];
};

export type PrayerMeResponse = ReadFocusMeta & {
  selfPersonId: number;
  hasPrayed: boolean;
};

export type CreateTributeInput = {
  content: string;
  photoUrls: string[];
};

export type TributeRow = {
  id: number;
  family_id: number;
  deceased_person_id: number;
  author_person_id: number;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  author_name: string;
};

export type TributePhotoRow = {
  id: number;
  tribute_id: number;
  photo_url: string;
  sort_order: number;
};

export type PrayerRow = {
  id: number;
  family_id: number;
  deceased_person_id: number;
  author_person_id: number;
  created_at: Date;
  author_name: string;
};

export type DeceasedListQuery = {
  q?: string;
  deathYear?: number;
};
