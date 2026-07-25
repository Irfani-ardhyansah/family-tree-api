import { describe, expect, it } from 'vitest';
import { PersonGraphNode } from '../persons/persons.types';
import {
  canAccessMemorial,
  collectMemorialConnectedIds,
  isDeceasedVisibleInPerspective,
} from './memoriam-access.service';

function node(
  id: number,
  fatherId: number | null = null,
  motherId: number | null = null,
  spouseIds: number[] = [],
): PersonGraphNode {
  return { id, gender: 'male', fatherId, motherId, spouseIds };
}

describe('memoriam-access.service', () => {
  const graph: PersonGraphNode[] = [
    node(1, null, null, [2]),
    node(2, null, null, [1]),
    node(3, 1, 2),
    node(4, 1, 2, [5]),
    node(5, null, null, [4]),
    node(10, null, null),
  ];

  it('connects deceased to parents, spouses, and children', () => {
    const connected = collectMemorialConnectedIds(1, graph);
    expect(connected.has(1)).toBe(true);
    expect(connected.has(2)).toBe(true);
    expect(connected.has(3)).toBe(true);
    expect(connected.has(4)).toBe(true);
    expect(connected.has(5)).toBe(true);
    expect(connected.has(10)).toBe(false);
  });

  it('allows memorial access only for connected viewers', () => {
    expect(canAccessMemorial(3, 1, graph)).toBe(true);
    expect(canAccessMemorial(10, 1, graph)).toBe(false);
  });

  it('shows deceased in perspective when in visible subgraph or memorial-linked to focus', () => {
    expect(isDeceasedVisibleInPerspective(1, 10, new Set([10]), graph)).toBe(false);
    expect(isDeceasedVisibleInPerspective(1, 3, new Set([1]), graph)).toBe(true);
    expect(isDeceasedVisibleInPerspective(1, 3, new Set([3]), graph)).toBe(true);
  });
});
