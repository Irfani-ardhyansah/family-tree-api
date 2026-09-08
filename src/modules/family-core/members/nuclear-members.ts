import { fcAccessRepository } from '../fc-access.repository';
import type { FcMemberDto, FcMemberKind } from '../fc.types';

const KIND_ORDER: Record<FcMemberKind, number> = {
  self: 0,
  spouse: 1,
  parent: 2,
  child: 3,
  in_law: 4,
};

type Candidate = {
  personId: number;
  kind: FcMemberKind;
  relationLabel: string | null;
};

/**
 * Keluarga inti relatif ke actor (bukan seluruh family_members).
 * Shared by GET /fc/members and document person validation.
 */
export async function resolveNuclearMembers(
  familyId: number,
  actorPersonId: number,
): Promise<FcMemberDto[]> {
  const candidates = new Map<number, Candidate>();

  const setCandidate = (personId: number, kind: FcMemberKind, relationLabel: string | null) => {
    if (!personId || personId <= 0) return;
    const existing = candidates.get(personId);
    // Prefer stronger relation if already present (lower KIND_ORDER wins)
    if (existing && KIND_ORDER[existing.kind] <= KIND_ORDER[kind]) return;
    candidates.set(personId, { personId, kind, relationLabel });
  };

  setCandidate(actorPersonId, 'self', 'Saya');

  const spouseIds = await fcAccessRepository.findSpouseIds(actorPersonId);
  for (const spouseId of spouseIds) {
    setCandidate(spouseId, 'spouse', 'Pasangan');
  }

  const selfParents = await fcAccessRepository.findParents(actorPersonId);
  if (selfParents?.father_id) {
    setCandidate(selfParents.father_id, 'parent', 'Ayah');
  }
  if (selfParents?.mother_id) {
    setCandidate(selfParents.mother_id, 'parent', 'Ibu');
  }

  const parentIdsForChildren = [actorPersonId, ...spouseIds];
  const childIds = await fcAccessRepository.findChildIdsOf(parentIdsForChildren);
  for (const childId of childIds) {
    setCandidate(childId, 'child', 'Anak');
  }

  for (const spouseId of spouseIds) {
    const inLaws = await fcAccessRepository.findParents(spouseId);
    if (!inLaws) continue;
    if (inLaws.father_id) {
      setCandidate(inLaws.father_id, 'in_law', 'Mertua (ayah)');
    }
    if (inLaws.mother_id) {
      setCandidate(inLaws.mother_id, 'in_law', 'Mertua (ibu)');
    }
  }

  const ids = [...candidates.keys()];
  const persons = await fcAccessRepository.findPersonsByIds(familyId, ids);
  const personMap = new Map(persons.map((p) => [p.id, p]));

  const members: FcMemberDto[] = [];
  for (const candidate of candidates.values()) {
    const person = personMap.get(candidate.personId);
    if (!person) continue; // only persons in this family (alive/not deleted)

    let relationLabel = candidate.relationLabel;
    if (candidate.kind === 'spouse') {
      if (person.gender === 'male') relationLabel = 'Suami';
      else if (person.gender === 'female') relationLabel = 'Istri';
    }

    members.push({
      personId: person.id,
      fullName: person.full_name,
      nickname: person.nickname,
      photoUrl: person.photo_url,
      gender: person.gender,
      kind: candidate.kind,
      relationLabel,
    });
  }

  return members.sort((a, b) => {
    const rank = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (rank !== 0) return rank;
    return a.fullName.localeCompare(b.fullName, 'id');
  });
}

export async function isNuclearMember(
  familyId: number,
  actorPersonId: number,
  personId: number,
): Promise<boolean> {
  const members = await resolveNuclearMembers(familyId, actorPersonId);
  return members.some((m) => m.personId === personId);
}
