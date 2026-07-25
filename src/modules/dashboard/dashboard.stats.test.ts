import { describe, expect, it } from 'vitest';
import { PersonGraphNode } from '../persons/persons.types';
import { countDistinctGenerations } from './dashboard.stats';

function node(
  id: number,
  opts: Partial<Pick<PersonGraphNode, 'fatherId' | 'motherId' | 'spouseIds' | 'gender'>> = {},
): PersonGraphNode {
  return {
    id,
    gender: opts.gender ?? 'male',
    fatherId: opts.fatherId ?? null,
    motherId: opts.motherId ?? null,
    spouseIds: opts.spouseIds ?? [],
  };
}

describe('countDistinctGenerations', () => {
  it('returns 0 when focus not in visible set', () => {
    const graph = [node(1)];
    expect(countDistinctGenerations(1, new Set(), graph)).toBe(0);
  });

  it('counts focus only as 1 generation', () => {
    const graph = [node(1)];
    expect(countDistinctGenerations(1, new Set([1]), graph)).toBe(1);
  });

  it('counts parents, focus, children, and spouse-same-gen', () => {
    // grandpa(3) -> father(2)+mother(4) -> focus(1)+spouse(5) -> child(6)
    const graph = [
      node(1, { fatherId: 2, motherId: 4, spouseIds: [5] }),
      node(2, { fatherId: 3, spouseIds: [4] }),
      node(3),
      node(4, { spouseIds: [2], gender: 'female' }),
      node(5, { spouseIds: [1], gender: 'female' }),
      node(6, { fatherId: 1, motherId: 5 }),
    ];
    const visible = new Set([1, 2, 3, 4, 5, 6]);
    expect(countDistinctGenerations(1, visible, graph)).toBe(4);
  });
});
