import { env } from '../../../config/env';
import { MediaPurpose } from './media.types';

export const MEDIA_PURPOSES: MediaPurpose[] = [
  'event',
  'event_contribution',
  'memoriam_tribute',
  'person',
  'money_transaction',
  'money_cash_withdrawal',
  'money_wishlist',
  'fc_document',
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

/** Max attach count per purpose — sourced from .env (`MEDIA_MAX_COUNT_*`). */
export const MAX_PHOTOS_BY_PURPOSE: Record<MediaPurpose, number> = {
  ...env.media.maxCountByPurpose,
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
  fc_document: 'family-core/documents',
};

export function buildStorageKey(purpose: MediaPurpose, id: string, ext: string): string {
  return `${STORAGE_DIR_BY_PURPOSE[purpose]}/${id}.${ext}`;
}
