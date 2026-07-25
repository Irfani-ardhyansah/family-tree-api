import { describe, expect, it } from 'vitest';
import { createMediaId } from './media.id';

describe('createMediaId', () => {
  it('returns med_ prefixed opaque id', () => {
    const id = createMediaId();
    expect(id).toMatch(/^med_[a-f0-9]{24}$/);
  });

  it('generates unique ids', () => {
    const a = createMediaId();
    const b = createMediaId();
    expect(a).not.toBe(b);
  });
});
