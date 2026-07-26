import { PersonGraphNode } from './persons.types';

/**
 * Cabang genealogi dari titik fokus:
 * - Naik: semua leluhur (father/mother)
 * - Turun: semua keturunan
 * - Pasangan: node spouse dari siapa pun di bloodline (tanpa expand ke bloodline spouse)
 */
export function collectFocusBranchIds(
  focusPersonId: number,
  persons: PersonGraphNode[],
): Set<number> {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const included = new Set<number>();

  if (!byId.has(focusPersonId)) {
    return included;
  }

  const ancestorStack = [focusPersonId];
  while (ancestorStack.length > 0) {
    const id = ancestorStack.pop()!;
    if (included.has(id)) {
      continue;
    }

    included.add(id);
    const person = byId.get(id);
    if (!person) {
      continue;
    }

    if (person.fatherId) {
      ancestorStack.push(person.fatherId);
    }
    if (person.motherId) {
      ancestorStack.push(person.motherId);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const person of persons) {
      if (included.has(person.id)) {
        continue;
      }

      const linkedViaFather = person.fatherId !== null && included.has(person.fatherId);
      const linkedViaMother = person.motherId !== null && included.has(person.motherId);
      if (linkedViaFather || linkedViaMother) {
        included.add(person.id);
        changed = true;
      }
    }
  }

  for (const id of [...included]) {
    const person = byId.get(id);
    if (!person) {
      continue;
    }
    for (const spouseId of person.spouseIds) {
      included.add(spouseId);
    }
  }

  return included;
}

export function filterRowsByBranch<T extends { id: number }>(
  rows: T[],
  branchIds: Set<number>,
): T[] {
  return rows.filter((row) => branchIds.has(row.id)).sort((a, b) => a.id - b.id);
}

/** Kedalaman leluhur terjauh dari titik fokus (0 = fokus tidak punya orang tua terdaftar). */
export function computeMaxAncestorDepth(
  focusPersonId: number,
  persons: PersonGraphNode[],
): number {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const memo = new Map<number, number>();

  function depth(personId: number): number {
    const cached = memo.get(personId);
    if (cached !== undefined) {
      return cached;
    }

    const person = byId.get(personId);
    if (!person) {
      memo.set(personId, 0);
      return 0;
    }

    const fatherDepth = person.fatherId ? depth(person.fatherId) + 1 : 0;
    const motherDepth = person.motherId ? depth(person.motherId) + 1 : 0;
    const result = Math.max(fatherDepth, motherDepth);
    memo.set(personId, result);
    return result;
  }

  return byId.has(focusPersonId) ? depth(focusPersonId) : 0;
}
