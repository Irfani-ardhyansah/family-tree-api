import { describe, expect, it } from 'vitest';
import {
  canAccessEvent,
  canManageEvent,
  isEventVisibleInPerspective,
  isRestrictedEvent,
} from './event-access.service';

describe('event-access.service', () => {
  it('treats empty attendees as open event', () => {
    expect(canAccessEvent([], 83)).toBe(true);
    expect(isRestrictedEvent([])).toBe(false);
  });

  it('restricts detail to attendees only', () => {
    expect(canAccessEvent([83], 83)).toBe(true);
    expect(canAccessEvent([83], 84)).toBe(false);
    expect(isRestrictedEvent([83])).toBe(true);
  });

  it('allows manage only for the creator', () => {
    expect(canManageEvent(83, 83)).toBe(true);
    expect(canManageEvent(83, 84)).toBe(false);
  });

  it('shows general events without personIds in any perspective', () => {
    expect(isEventVisibleInPerspective([], new Set([1, 2]))).toBe(true);
  });

  it('shows linked events when person overlaps visible subgraph', () => {
    expect(isEventVisibleInPerspective([84], new Set([10, 84]))).toBe(true);
    expect(isEventVisibleInPerspective([84], new Set([10, 11]))).toBe(false);
  });
});
