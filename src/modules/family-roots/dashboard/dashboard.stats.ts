import { PersonGraphNode } from '../persons/persons.types';

/**
 * Hitung jumlah lapisan generasi distinct di subgraph visible,
 * relatif ke focus (parent = gen-1, child = gen+1, spouse = gen sama).
 */
export function countDistinctGenerations(
  focusPersonId: number,
  visibleIds: Set<number>,
  graph: PersonGraphNode[],
): number {
  const byId = new Map(graph.map((person) => [person.id, person]));
  if (!visibleIds.has(focusPersonId) || !byId.has(focusPersonId)) {
    return 0;
  }

  const generation = new Map<number, number>();
  const queue = [focusPersonId];
  generation.set(focusPersonId, 0);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentGen = generation.get(currentId)!;
    const person = byId.get(currentId);
    if (!person) {
      continue;
    }

    for (const parentId of [person.fatherId, person.motherId]) {
      if (parentId === null || !visibleIds.has(parentId) || generation.has(parentId)) {
        continue;
      }
      generation.set(parentId, currentGen - 1);
      queue.push(parentId);
    }

    for (const other of byId.values()) {
      if (!visibleIds.has(other.id) || generation.has(other.id)) {
        continue;
      }
      if (other.fatherId === currentId || other.motherId === currentId) {
        generation.set(other.id, currentGen + 1);
        queue.push(other.id);
      }
    }

    for (const spouseId of person.spouseIds) {
      if (!visibleIds.has(spouseId) || generation.has(spouseId)) {
        continue;
      }
      generation.set(spouseId, currentGen);
      queue.push(spouseId);
    }
  }

  return new Set(generation.values()).size;
}
