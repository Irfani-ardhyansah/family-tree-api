export type MediaPurpose = 'event' | 'event_contribution' | 'memoriam_tribute' | 'person';
export type MediaStatus = 'pending' | 'attached' | 'deleted';
export type MediaAttachedToType = 'event' | 'event_contribution' | 'tribute' | 'person';

export type MediaRow = {
  id: string;
  uploader_person_id: number;
  family_id: number;
  purpose: MediaPurpose;
  status: MediaStatus;
  url: string;
  storage_key: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  context_id: string | null;
  attached_to_type: MediaAttachedToType | null;
  attached_to_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type MediaItem = {
  id: string;
  url: string;
  purpose: MediaPurpose;
  status: MediaStatus;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export type MediaCleanupResult = {
  deletedIds: string[];
  skippedIds: string[];
};

export type AttachMediaTarget = {
  type: MediaAttachedToType;
  id: string;
  purpose: MediaPurpose;
  maxCount: number;
};

export type ResolvedMediaPhotos = {
  mediaIds: string[];
  photoUrls: string[];
};
