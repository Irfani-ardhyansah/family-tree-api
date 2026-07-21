import { describe, expect, it } from 'vitest';
import { PersonGraphNode } from './persons.types';
import { filterTreeSubgraph } from './tree-subgraph.service';
import { TREE_FILTER_DEFAULTS } from './tree-filter-query.service';

function node(
  id: number,
  fatherId: number | null,
  motherId: number | null,
  spouseIds: number[] = [],
  gender: 'male' | 'female' = 'male',
): PersonGraphNode {
  return { id, gender, fatherId, motherId, spouseIds };
}

/** Seed-like mini graph: 83=self, 84=spouse, 50=sibling, 85/86=children */
const seedGraph: PersonGraphNode[] = [
  node(40, null, null, [41]),
  node(41, null, null, [40], 'female'),
  node(42, null, null, [43]),
  node(43, null, null, [42], 'female'),
  node(49, 40, 41),
  node(50, 49, 60),
  node(60, 42, 43, [], 'female'),
  node(70, null, null),
  node(71, null, null, [], 'female'),
  node(72, null, null),
  node(73, null, null, [], 'female'),
  node(77, 70, 71),
  node(78, 72, 73, [], 'female'),
  node(83, 49, 60, [84]),
  node(84, 77, 78, [83], 'female'),
  node(85, 83, 84),
  node(86, 83, 84),
];

function filterIds(
  focusPersonId: number,
  selfPersonId: number,
  graph: PersonGraphNode[],
  overrides: Partial<typeof TREE_FILTER_DEFAULTS> = {},
) {
  const result = filterTreeSubgraph(focusPersonId, selfPersonId, graph, {
    ...TREE_FILTER_DEFAULTS,
    ...overrides,
  });
  return [...result.visibleIds].sort((a, b) => a - b);
}

describe('tree-subgraph.service', () => {
  it('full graph baseline includes all nodes when filter uses defaults', () => {
    const ids = filterIds(83, 83, seedGraph);
    expect(ids.length).toBeLessThan(seedGraph.length);
    expect(ids).toContain(83);
    expect(ids).toContain(84);
    expect(ids).toContain(49);
    expect(ids).toContain(60);
  });

  it('paternal lineage — father chain + bridge mother, excludes spouse parents', () => {
    const ids = filterIds(83, 83, seedGraph, {
      lineage: 'paternal',
      generationsUp: 4,
    });

    expect(ids).toContain(83);
    expect(ids).toContain(49);
    expect(ids).toContain(40);
    expect(ids).toContain(41);
    expect(ids).toContain(60);
    expect(ids).toContain(84);
    expect(ids).not.toContain(77);
    expect(ids).not.toContain(78);
    expect(ids).not.toContain(50);
    expect(ids).not.toContain(85);
  });

  it('maternal lineage — mother chain + bridge father', () => {
    const ids = filterIds(83, 83, seedGraph, {
      lineage: 'maternal',
      generationsUp: 2,
    });

    expect(ids).toContain(83);
    expect(ids).toContain(60);
    expect(ids).toContain(42);
    expect(ids).toContain(43);
    expect(ids).toContain(49);
    expect(ids).not.toContain(40);
    expect(ids).not.toContain(77);
  });

  it('generationsUp=1 limits ancestor depth', () => {
    const ids = filterIds(83, 83, seedGraph, {
      lineage: 'both',
      generationsUp: 1,
    });

    expect(ids).toContain(83);
    expect(ids).toContain(49);
    expect(ids).toContain(60);
    expect(ids).not.toContain(40);
    expect(ids).not.toContain(42);
  });

  it('showSiblings=false excludes focus sibling', () => {
    const ids = filterIds(83, 83, seedGraph, { showSiblings: false });
    expect(ids).not.toContain(50);
  });

  it('showSiblings=true includes focus sibling when focus=self', () => {
    const ids = filterIds(83, 83, seedGraph, { showSiblings: true });
    expect(ids).toContain(50);
  });

  it('showSiblings=true does not include user siblings when focus=spouse', () => {
    const ids = filterIds(84, 83, seedGraph, { showSiblings: true });
    expect(ids).not.toContain(50);
  });

  it('showChildren=true adds one generation below focus', () => {
    const ids = filterIds(83, 83, seedGraph, { showChildren: true });
    expect(ids).toContain(85);
    expect(ids).toContain(86);
  });

  it('showChildren with spouse focus includes shared children via selfPersonId', () => {
    const ids = filterIds(84, 83, seedGraph, { showChildren: true });
    expect(ids).toContain(85);
    expect(ids).toContain(86);
    expect(ids).toContain(83);
  });

  it('showSpouses=true includes spouses of visible siblings', () => {
    const ids = filterIds(83, 83, seedGraph, {
      showSiblings: true,
      showSpouses: true,
    });

    expect(ids).toContain(50);
  });

  it('full preset returns more nodes than minimal paternal preset', () => {
    const minimal = filterIds(83, 83, seedGraph, {
      lineage: 'paternal',
      generationsUp: 4,
    });
    const full = filterIds(83, 83, seedGraph, {
      lineage: 'both',
      generationsUp: 4,
      showSpouses: true,
      showSiblings: true,
      showChildren: true,
    });

    expect(full.length).toBeGreaterThan(minimal.length);
    expect(full).toContain(50);
    expect(full).toContain(85);
  });

  it('focus spouse shifts blood line to spouse ancestors', () => {
    const ids = filterIds(84, 83, seedGraph, {
      lineage: 'both',
      generationsUp: 2,
    });

    expect(ids).toContain(84);
    expect(ids).toContain(77);
    expect(ids).toContain(78);
    expect(ids).toContain(83);
    expect(ids).not.toContain(49);
    expect(ids).not.toContain(60);
  });

  it('ancestor siblings pruned above BUYUT depth', () => {
    const deepGraph: PersonGraphNode[] = [
      node(1, null, null),
      node(11, null, null),
      node(10, null, null, [], 'female'),
      node(2, 1, 10, [], 'female'),
      node(12, 1, 10),
      node(3, 2, 10),
      node(4, 3, 20, [], 'female'),
      node(20, null, null, [], 'female'),
      node(5, 4, 20),
    ];

    const result = filterTreeSubgraph(5, 5, deepGraph, {
      ...TREE_FILTER_DEFAULTS,
      lineage: 'paternal',
      generationsUp: 4,
      showSiblings: true,
    });

    expect(result.visibleIds.has(12)).toBe(true);
    expect(result.visibleIds.has(11)).toBe(false);
  });

  it('subgraph count is smaller than full family for seed graph', () => {
    const subgraph = filterTreeSubgraph(83, 83, seedGraph, {
      ...TREE_FILTER_DEFAULTS,
      lineage: 'paternal',
      generationsUp: 2,
    });

    expect(subgraph.visibleIds.size).toBeLessThan(seedGraph.length);
    expect(subgraph.maxAncestorDepth).toBe(2);
  });

  it('reports non-bidirectional spouse warnings', () => {
    const brokenGraph: PersonGraphNode[] = [
      node(1, null, null, [2]),
      node(2, null, null, [], 'female'),
    ];

    const result = filterTreeSubgraph(1, 1, brokenGraph, TREE_FILTER_DEFAULTS);
    expect(result.graphWarnings.some((w) => w.includes('bidirectional'))).toBe(true);
  });
});
