import { PersonGraphNode } from '../persons/persons.types';

function getChildIds(personId: number, graph: PersonGraphNode[]): number[] {
  return graph
    .filter((person) => person.fatherId === personId || person.motherId === personId)
    .map((person) => person.id);
}

/**
 * BFS dari mendiang via ayah/ibu, pasangan, dan anak (reverse parent).
 * Viewer harus ada di connected set — selaras FE memoriamAccess.ts.
 */
export function collectMemorialConnectedIds(
  deceasedId: number,
  graph: PersonGraphNode[],
): Set<number> {
  const byId = new Map(graph.map((person) => [person.id, person]));
  const connected = new Set<number>();

  if (!byId.has(deceasedId)) {
    return connected;
  }

  const queue = [deceasedId];
  connected.add(deceasedId);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const person = byId.get(currentId);
    if (!person) {
      continue;
    }

    const neighbors: number[] = [];
    if (person.fatherId !== null) {
      neighbors.push(person.fatherId);
    }
    if (person.motherId !== null) {
      neighbors.push(person.motherId);
    }
    neighbors.push(...person.spouseIds);
    neighbors.push(...getChildIds(currentId, graph));

    for (const neighborId of neighbors) {
      if (!byId.has(neighborId) || connected.has(neighborId)) {
        continue;
      }
      connected.add(neighborId);
      queue.push(neighborId);
    }
  }

  return connected;
}

export function canAccessMemorial(
  viewerPersonId: number,
  deceasedId: number,
  graph: PersonGraphNode[],
): boolean {
  const connected = collectMemorialConnectedIds(deceasedId, graph);
  return connected.has(viewerPersonId);
}

/** Mendiang tampil saat fokus jika ada di subgraph visible ATAU terhubung langsung ke focus via graph memorial. */
export function isDeceasedVisibleInPerspective(
  deceasedId: number,
  focusPersonId: number,
  visiblePersonIds: Set<number>,
  graph: PersonGraphNode[],
): boolean {
  if (visiblePersonIds.has(deceasedId)) {
    return true;
  }

  const connectedToDeceased = collectMemorialConnectedIds(deceasedId, graph);
  return connectedToDeceased.has(focusPersonId);
}
