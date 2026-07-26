import { PersonGraphNode, TreeSubgraphFilter } from './persons.types';

/** Di atas depth buyut (3), saudara leluhur tidak ditampilkan — selaras FE treeLayout.ts */
export const BUYUT_ANCESTOR_DEPTH = 3;

export type TreeSubgraphResult = {
  visibleIds: Set<number>;
  graphWarnings: string[];
  maxAncestorDepth: number;
};

type GraphContext = {
  byId: Map<number, PersonGraphNode>;
  all: PersonGraphNode[];
};

function buildGraphContext(persons: PersonGraphNode[]): GraphContext {
  return {
    byId: new Map(persons.map((person) => [person.id, person])),
    all: persons,
  };
}

function getValidatedSpouseIds(person: PersonGraphNode, ctx: GraphContext): number[] {
  return person.spouseIds.filter((spouseId) => {
    const spouse = ctx.byId.get(spouseId);
    return spouse !== undefined && spouse.spouseIds.includes(person.id);
  });
}

function getFullSiblingIds(personId: number, ctx: GraphContext): number[] {
  const person = ctx.byId.get(personId);
  if (!person || person.fatherId === null || person.motherId === null) {
    return [];
  }

  return ctx.all
    .filter(
      (candidate) =>
        candidate.id !== personId &&
        candidate.fatherId === person.fatherId &&
        candidate.motherId === person.motherId,
    )
    .map((candidate) => candidate.id);
}

function getChildIds(personId: number, ctx: GraphContext): number[] {
  return ctx.all
    .filter((person) => person.fatherId === personId || person.motherId === personId)
    .map((person) => person.id);
}

function isValidParentLink(
  child: PersonGraphNode,
  parentId: number | null,
  ctx: GraphContext,
): parentId is number {
  if (parentId === null) {
    return false;
  }
  return ctx.byId.has(parentId);
}

function collectBloodLineDepths(
  focusPersonId: number,
  filter: TreeSubgraphFilter,
  ctx: GraphContext,
): Map<number, number> {
  const depths = new Map<number, number>();

  if (!ctx.byId.has(focusPersonId)) {
    return depths;
  }

  depths.set(focusPersonId, 0);

  if (filter.lineage === 'both') {
    const queue: Array<{ id: number; depth: number }> = [{ id: focusPersonId, depth: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= filter.generationsUp) {
        continue;
      }

      const person = ctx.byId.get(current.id);
      if (!person) {
        continue;
      }

      for (const parentId of [person.fatherId, person.motherId]) {
        if (!isValidParentLink(person, parentId, ctx) || depths.has(parentId)) {
          continue;
        }
        depths.set(parentId, current.depth + 1);
        queue.push({ id: parentId, depth: current.depth + 1 });
      }
    }

    return depths;
  }

  const parentKey = filter.lineage === 'paternal' ? 'fatherId' : 'motherId';
  let currentId: number | null = focusPersonId;

  while (currentId !== null) {
    const person = ctx.byId.get(currentId);
    if (!person) {
      break;
    }

    const nextParentId = person[parentKey];
    if (!isValidParentLink(person, nextParentId, ctx)) {
      break;
    }

    const nextDepth = (depths.get(currentId) ?? 0) + 1;
    if (nextDepth > filter.generationsUp) {
      break;
    }

    depths.set(nextParentId, nextDepth);
    currentId = nextParentId;
  }

  return depths;
}

function markStructuralAndBridgeParents(
  bloodLine: Map<number, number>,
  lineage: TreeSubgraphFilter['lineage'],
  ctx: GraphContext,
  structural: Set<number>,
  bridge: Set<number>,
): void {
  if (lineage === 'both') {
    return;
  }

  for (const personId of bloodLine.keys()) {
    const person = ctx.byId.get(personId);
    if (!person) {
      continue;
    }

    if (lineage === 'paternal') {
      if (isValidParentLink(person, person.motherId, ctx) && !bloodLine.has(person.motherId)) {
        structural.add(person.motherId);
        bridge.add(person.motherId);
      }
      continue;
    }

    if (isValidParentLink(person, person.fatherId, ctx) && !bloodLine.has(person.fatherId)) {
      structural.add(person.fatherId);
      bridge.add(person.fatherId);
    }
  }
}

function addRootSpouses(
  focusPersonId: number,
  ctx: GraphContext,
  visible: Set<number>,
): void {
  const focus = ctx.byId.get(focusPersonId);
  if (!focus) {
    return;
  }

  for (const spouseId of getValidatedSpouseIds(focus, ctx)) {
    visible.add(spouseId);
  }
}

function addSiblingLayers(
  focusPersonId: number,
  selfPersonId: number,
  bloodLine: Map<number, number>,
  visible: Set<number>,
  layerKeep: Set<number>,
  ctx: GraphContext,
): void {
  if (focusPersonId === selfPersonId) {
    for (const siblingId of getFullSiblingIds(focusPersonId, ctx)) {
      visible.add(siblingId);
      layerKeep.add(siblingId);
    }
  }

  for (const [ancestorId, depth] of bloodLine) {
    if (depth === 0 || depth > BUYUT_ANCESTOR_DEPTH) {
      continue;
    }

    for (const siblingId of getFullSiblingIds(ancestorId, ctx)) {
      visible.add(siblingId);
      layerKeep.add(siblingId);
    }
  }
}

/**
 * Pasangan yang diizinkan saat `showSpouses`:
 * - orang di blood line (pasangan struktural)
 * - fokus
 * - saudara kandung fokus (bukan saudara leluhur — itu in-law tanpa jalur ke roots)
 */
function addSpouseLayers(
  focusPersonId: number,
  selfPersonId: number,
  bloodLine: Map<number, number>,
  visible: Set<number>,
  ctx: GraphContext,
): void {
  const eligible = new Set<number>(bloodLine.keys());
  eligible.add(focusPersonId);

  if (focusPersonId === selfPersonId) {
    for (const siblingId of getFullSiblingIds(focusPersonId, ctx)) {
      if (visible.has(siblingId)) {
        eligible.add(siblingId);
      }
    }
  }

  for (const personId of eligible) {
    if (!visible.has(personId)) {
      continue;
    }
    const person = ctx.byId.get(personId);
    if (!person) {
      continue;
    }
    for (const spouseId of getValidatedSpouseIds(person, ctx)) {
      visible.add(spouseId);
    }
  }
}

function isAncestorOnBloodLine(personId: number, bloodLine: Map<number, number>): boolean {
  const depth = bloodLine.get(personId);
  return depth !== undefined && depth > 0;
}

function addChildrenLayer(
  focusPersonId: number,
  selfPersonId: number,
  filter: TreeSubgraphFilter,
  bloodLine: Map<number, number>,
  visible: Set<number>,
  layerKeep: Set<number>,
  ctx: GraphContext,
): void {
  const childSources = new Set<number>([focusPersonId]);

  if (focusPersonId !== selfPersonId && ctx.byId.has(selfPersonId)) {
    childSources.add(selfPersonId);
  }

  if (filter.showSiblings) {
    for (const personId of visible) {
      if (!isAncestorOnBloodLine(personId, bloodLine)) {
        childSources.add(personId);
      }
    }
  }

  for (const sourceId of childSources) {
    for (const childId of getChildIds(sourceId, ctx)) {
      visible.add(childId);
      layerKeep.add(childId);
    }
  }
}

function pruneSpouseOnlyNodes(
  focusPersonId: number,
  bloodLine: Map<number, number>,
  structural: Set<number>,
  bridge: Set<number>,
  layerKeep: Set<number>,
  visible: Set<number>,
  ctx: GraphContext,
): void {
  const focus = ctx.byId.get(focusPersonId);
  const rootSpouseIds = new Set(
    focus ? getValidatedSpouseIds(focus, ctx) : [],
  );

  for (const personId of [...visible]) {
    if (bloodLine.has(personId)) {
      continue;
    }
    if (structural.has(personId)) {
      continue;
    }
    if (bridge.has(personId)) {
      continue;
    }
    if (rootSpouseIds.has(personId)) {
      continue;
    }
    if (layerKeep.has(personId)) {
      continue;
    }

    visible.delete(personId);
  }
}

/**
 * Hapus node yang tidak terhubung ke fokus via edge terlihat
 * (ayah/ibu/anak/pasangan di dalam `visible`).
 *
 * Saat `showSiblings` + `showSpouses`, saudara leluhur yang parent-nya di luar
 * `generationsUp` (beserta pasangannya) bisa masuk tanpa jalur ke fokus — muncul
 * sebagai pulau terputus di FE.
 */
function pruneDisconnectedFromFocus(
  focusPersonId: number,
  visible: Set<number>,
  ctx: GraphContext,
): void {
  if (!visible.has(focusPersonId)) {
    return;
  }

  const childrenOf = new Map<number, number[]>();
  for (const personId of visible) {
    const person = ctx.byId.get(personId);
    if (!person) {
      continue;
    }
    for (const parentId of [person.fatherId, person.motherId]) {
      if (parentId === null || !visible.has(parentId)) {
        continue;
      }
      const list = childrenOf.get(parentId) ?? [];
      list.push(personId);
      childrenOf.set(parentId, list);
    }
  }

  const reachable = new Set<number>([focusPersonId]);
  const queue = [focusPersonId];

  while (queue.length > 0) {
    const personId = queue.shift()!;
    const person = ctx.byId.get(personId);
    if (!person) {
      continue;
    }

    const neighbors: number[] = [];
    if (person.fatherId !== null && visible.has(person.fatherId)) {
      neighbors.push(person.fatherId);
    }
    if (person.motherId !== null && visible.has(person.motherId)) {
      neighbors.push(person.motherId);
    }
    for (const spouseId of getValidatedSpouseIds(person, ctx)) {
      if (visible.has(spouseId)) {
        neighbors.push(spouseId);
      }
    }
    for (const childId of childrenOf.get(personId) ?? []) {
      neighbors.push(childId);
    }

    for (const neighborId of neighbors) {
      if (!reachable.has(neighborId)) {
        reachable.add(neighborId);
        queue.push(neighborId);
      }
    }
  }

  for (const personId of [...visible]) {
    if (!reachable.has(personId)) {
      visible.delete(personId);
    }
  }
}

function computeMaxDepthInBloodLine(bloodLine: Map<number, number>): number {
  let max = 0;
  for (const depth of bloodLine.values()) {
    if (depth > max) {
      max = depth;
    }
  }
  return max;
}

function collectGraphWarnings(persons: PersonGraphNode[], ctx: GraphContext): string[] {
  const warnings: string[] = [];

  for (const person of persons) {
    for (const spouseId of person.spouseIds) {
      const spouse = ctx.byId.get(spouseId);
      if (!spouse) {
        warnings.push(`Spouse ${spouseId} untuk person ${person.id} tidak ditemukan.`);
        continue;
      }
      if (!spouse.spouseIds.includes(person.id)) {
        warnings.push(`Spouse link ${person.id}<->${spouseId} tidak bidirectional.`);
      }
    }

    if (person.fatherId !== null && !ctx.byId.has(person.fatherId)) {
      warnings.push(`fatherId ${person.fatherId} untuk person ${person.id} tidak valid.`);
    }
    if (person.motherId !== null && !ctx.byId.has(person.motherId)) {
      warnings.push(`motherId ${person.motherId} untuk person ${person.id} tidak valid.`);
    }
  }

  return warnings;
}

/**
 * Menghasilkan visible set subgraph pohon — selaras FE filterPersons() di treeLayout.ts.
 */
export function filterTreeSubgraph(
  focusPersonId: number,
  selfPersonId: number,
  persons: PersonGraphNode[],
  filter: TreeSubgraphFilter,
): TreeSubgraphResult {
  const ctx = buildGraphContext(persons);
  const graphWarnings = collectGraphWarnings(persons, ctx);
  const bloodLine = collectBloodLineDepths(focusPersonId, filter, ctx);
  const structural = new Set<number>();
  const bridge = new Set<number>();
  const layerKeep = new Set<number>();
  const visible = new Set<number>();

  if (!ctx.byId.has(focusPersonId)) {
    return { visibleIds: visible, graphWarnings, maxAncestorDepth: 0 };
  }

  for (const personId of bloodLine.keys()) {
    visible.add(personId);
  }

  markStructuralAndBridgeParents(bloodLine, filter.lineage, ctx, structural, bridge);
  for (const personId of structural) {
    visible.add(personId);
  }
  for (const personId of bridge) {
    visible.add(personId);
  }

  addRootSpouses(focusPersonId, ctx, visible);

  if (filter.showSiblings) {
    addSiblingLayers(focusPersonId, selfPersonId, bloodLine, visible, layerKeep, ctx);
  }

  if (filter.showSpouses) {
    addSpouseLayers(focusPersonId, selfPersonId, bloodLine, visible, ctx);
  }

  if (filter.showChildren) {
    addChildrenLayer(
      focusPersonId,
      selfPersonId,
      filter,
      bloodLine,
      visible,
      layerKeep,
      ctx,
    );
  }

  if (!filter.showSpouses) {
    pruneSpouseOnlyNodes(
      focusPersonId,
      bloodLine,
      structural,
      bridge,
      layerKeep,
      visible,
      ctx,
    );
  }

  pruneDisconnectedFromFocus(focusPersonId, visible, ctx);

  return {
    visibleIds: visible,
    graphWarnings,
    maxAncestorDepth: computeMaxDepthInBloodLine(bloodLine),
  };
}
