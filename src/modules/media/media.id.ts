import { randomBytes } from 'crypto';

/** Prefixed opaque id, e.g. `med_a1b2c3…` (matches MEDIA-UPLOAD-API.md). */
export function createMediaId(): string {
  return `med_${randomBytes(12).toString('hex')}`;
}
