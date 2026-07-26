import { describe, expect, it } from 'vitest';
import { collectFocusBranchIds, computeMaxAncestorDepth } from './focus-branch.service';
import { PersonGraphNode } from './persons.types';

function node(
  id: number,
  fatherId: number | null,
  motherId: number | null,
  spouseIds: number[] = [],
): PersonGraphNode {
  return { id, gender: 'male', fatherId, motherId, spouseIds };
}

describe('focus-branch.service', () => {
  const graph: PersonGraphNode[] = [
    node(49, 40, 41),
    node(60, 42, 43),
    node(77, 70, 71),
    node(78, 72, 73),
    node(83, 49, 60, [84]),
    node(84, 77, 78, [83]),
    node(85, 83, 84),
    node(86, 83, 84),
    node(50, 49, 60),
  ];

  it('focus self — bloodline user + spouse node, exclude spouse parents', () => {
    const ids = collectFocusBranchIds(83, graph);
    expect(ids.has(83)).toBe(true);
    expect(ids.has(49)).toBe(true);
    expect(ids.has(60)).toBe(true);
    expect(ids.has(84)).toBe(true);
    expect(ids.has(85)).toBe(true);
    expect(ids.has(86)).toBe(true);
    expect(ids.has(50)).toBe(true);
    expect(ids.has(77)).toBe(false);
    expect(ids.has(78)).toBe(false);
  });

  it('focus spouse — bloodline spouse + user as spouse, exclude user parents', () => {
    const ids = collectFocusBranchIds(84, graph);
    expect(ids.has(84)).toBe(true);
    expect(ids.has(77)).toBe(true);
    expect(ids.has(78)).toBe(true);
    expect(ids.has(83)).toBe(true);
    expect(ids.has(85)).toBe(true);
    expect(ids.has(86)).toBe(true);
    expect(ids.has(49)).toBe(false);
    expect(ids.has(60)).toBe(false);
    expect(ids.has(50)).toBe(false);
  });

  it('computeMaxAncestorDepth — longest parent chain from focus', () => {
    const chainGraph: PersonGraphNode[] = [
      node(1, null, null),
      node(2, 1, null),
      node(3, 2, null),
      node(4, 3, null),
      node(5, 4, null, [6]),
      node(6, null, null, [5]),
    ];

    expect(computeMaxAncestorDepth(5, chainGraph)).toBe(4);
    expect(computeMaxAncestorDepth(6, chainGraph)).toBe(0);
    expect(computeMaxAncestorDepth(999, chainGraph)).toBe(0);
  });
});
