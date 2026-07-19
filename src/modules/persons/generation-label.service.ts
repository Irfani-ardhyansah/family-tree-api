import { PersonGraphNode } from './persons.types';

function sameParents(a: PersonGraphNode, b: PersonGraphNode): boolean {
  return a.fatherId !== null && a.fatherId === b.fatherId && a.motherId !== null && a.motherId === b.motherId;
}

type Side = 'ayah' | 'ibu';

function ancestorLabel(depth: number, gender: 'male' | 'female', side: Side): string {
  const sideLabel = side === 'ayah' ? 'Ayah' : 'Ibu';

  if (depth === 1) {
    return gender === 'male' ? 'Ayah' : 'Ibu';
  }
  if (depth === 2) {
    return gender === 'male' ? `Kakek (${sideLabel})` : `Nenek (${sideLabel})`;
  }
  if (depth === 3) {
    return gender === 'male' ? `Buyut (${sideLabel})` : `Buyut (${sideLabel})`;
  }
  return `Orang Tua Buyut (${sideLabel})`;
}

function descendantLabel(depth: number): string {
  if (depth === 1) return 'Anak';
  if (depth === 2) return 'Cucu';
  if (depth === 3) return 'Cicit';
  return 'Keturunan';
}

function walkAncestors(
  startId: number,
  parentKey: 'fatherId' | 'motherId',
  byId: Map<number, PersonGraphNode>,
): Array<{ id: number; depth: number; side: Side }> {
  const side: Side = parentKey === 'fatherId' ? 'ayah' : 'ibu';
  const result: Array<{ id: number; depth: number; side: Side }> = [];
  let current = byId.get(startId);
  let depth = 0;

  while (current) {
    const parentId = current[parentKey];
    if (!parentId) break;
    depth += 1;
    result.push({ id: parentId, depth, side });
    current = byId.get(parentId);
  }

  return result;
}

function findDescendantDepth(viewerId: number, targetId: number, byId: Map<number, PersonGraphNode>): number | null {
  const queue: Array<{ id: number; depth: number }> = [{ id: viewerId, depth: 0 }];
  const visited = new Set<number>([viewerId]);

  while (queue.length > 0) {
    const node = queue.shift()!;
    const person = byId.get(node.id);
    if (!person) continue;

    for (const other of byId.values()) {
      if (other.fatherId === node.id || other.motherId === node.id) {
        if (other.id === targetId) {
          return node.depth + 1;
        }
        if (!visited.has(other.id)) {
          visited.add(other.id);
          queue.push({ id: other.id, depth: node.depth + 1 });
        }
      }
    }
  }

  return null;
}

function isParentSibling(
  viewer: PersonGraphNode,
  target: PersonGraphNode,
  byId: Map<number, PersonGraphNode>,
): boolean {
  const parentIds = [viewer.fatherId, viewer.motherId].filter((id): id is number => id !== null);
  for (const parentId of parentIds) {
    const parent = byId.get(parentId);
    if (!parent) continue;
    if (sameParents(parent, target) && target.id !== parentId) {
      return true;
    }
  }
  return false;
}

export class GenerationLabelService {
  build(viewerId: number, targetId: number, persons: PersonGraphNode[]): string {
    if (viewerId === targetId) {
      return 'Kamu';
    }

    const byId = new Map(persons.map((person) => [person.id, person]));
    const viewer = byId.get(viewerId);
    const target = byId.get(targetId);
    if (!viewer || !target) {
      return '';
    }

    if (target.id === viewer.fatherId) return 'Ayah';
    if (target.id === viewer.motherId) return 'Ibu';

    if (target.fatherId === viewerId || target.motherId === viewerId) {
      return 'Anak';
    }

    if (viewer.spouseIds.includes(targetId)) {
      return 'Pasangan';
    }

    if (sameParents(viewer, target)) {
      return 'Saudara';
    }

    for (const entry of walkAncestors(viewerId, 'fatherId', byId)) {
      if (entry.id === targetId) {
        return ancestorLabel(entry.depth, target.gender, entry.side);
      }
    }

    for (const entry of walkAncestors(viewerId, 'motherId', byId)) {
      if (entry.id === targetId) {
        return ancestorLabel(entry.depth, target.gender, entry.side);
      }
    }

    const descendantDepth = findDescendantDepth(viewerId, targetId, byId);
    if (descendantDepth !== null) {
      return descendantLabel(descendantDepth);
    }

    if (isParentSibling(viewer, target, byId)) {
      return target.gender === 'male' ? 'Paman' : 'Bibi';
    }

    return '';
  }
}

export const generationLabelService = new GenerationLabelService();
