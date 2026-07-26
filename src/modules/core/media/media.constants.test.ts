import { describe, expect, it } from 'vitest';
import { STORAGE_DIR_BY_PURPOSE, buildStorageKey } from './media.constants';

describe('media storage directories', () => {
  it('keeps events and contributions under events/', () => {
    expect(STORAGE_DIR_BY_PURPOSE.event).toBe('events');
    expect(STORAGE_DIR_BY_PURPOSE.event_contribution).toBe('events');
    expect(buildStorageKey('event', 'med_abc', 'jpg')).toBe('events/med_abc.jpg');
    expect(buildStorageKey('event_contribution', 'med_abc', 'png')).toBe('events/med_abc.png');
  });

  it('stores tributes under memoriam/ and avatars under persons/', () => {
    expect(buildStorageKey('memoriam_tribute', 'med_xyz', 'webp')).toBe('memoriam/med_xyz.webp');
    expect(buildStorageKey('person', 'med_xyz', 'jpg')).toBe('persons/med_xyz.jpg');
  });
});
