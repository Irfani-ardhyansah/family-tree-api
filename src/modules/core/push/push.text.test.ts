import { describe, expect, it } from 'vitest';
import { stripHtml, truncate } from './push.text';

describe('push.text', () => {
  it('strips html for push body', () => {
    expect(stripHtml('<p>Halo <b>keluarga</b></p>')).toBe('Halo keluarga');
  });

  it('truncates long text', () => {
    expect(truncate('a'.repeat(130), 10)).toBe('aaaaaaaaa…');
  });
});
