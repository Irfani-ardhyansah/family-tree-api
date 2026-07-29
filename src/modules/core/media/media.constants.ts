import { MediaPurpose } from './media.types';

export const MEDIA_PURPOSES: MediaPurpose[] = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
  'money_transaction',
  'money_cash_withdrawal',
  'money_wishlist',
];

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const MAX_PHOTOS_BY_PURPOSE: Record<MediaPurpose, number> = {
  event: 10,
  event_contribution: 10,
  memoriam_tribute: 8,
  person: 1,
  money_transaction: 3,
  money_cash_withdrawal: 3,
  money_wishlist: 1,
};

/**
 * Subdirectory under MEDIA_STORAGE_DIR / public `/media`.
 * Events & contributions share `events/`; tributes → `memoriam/`; avatar → `persons`.
 */
export const STORAGE_DIR_BY_PURPOSE: Record<MediaPurpose, string> = {
  event: 'events',
  event_contribution: 'events',
  memoriam_tribute: 'memoriam',
  person: 'persons',
  money_transaction: 'money',
  money_cash_withdrawal: 'money',
  money_wishlist: 'money',
};

export function buildStorageKey(purpose: MediaPurpose, id: string, ext: string): string {
  return `${STORAGE_DIR_BY_PURPOSE[purpose]}/${id}.${ext}`;
}
