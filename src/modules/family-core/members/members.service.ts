import { resolveFcContext } from '../fc.access';
import { fcAccessRepository } from '../fc-access.repository';
import type { FcMemberDto } from '../fc.types';

export class MembersService {
  async list(authPersonId: number, familyId: number): Promise<FcMemberDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    const core = await fcAccessRepository.listCoreMembers(ctx.familyId);
    const byId = new Map<number, FcMemberDto>();

    for (const m of core) {
      byId.set(m.person_id, {
        personId: m.person_id,
        fullName: m.full_name,
        nickname: m.nickname,
        photoUrl: m.photo_url,
        gender: m.gender,
        kind: 'core',
        relationLabel: null,
      });
    }

    const inLawIds = new Set<number>();
    const fatherIds = new Set<number>();
    const motherIds = new Set<number>();

    for (const member of core) {
      const spouses = await fcAccessRepository.findSpouseIds(member.person_id);
      for (const spouseId of spouses) {
        const parents = await fcAccessRepository.findParents(spouseId);
        if (!parents) continue;
        if (parents.father_id) {
          inLawIds.add(parents.father_id);
          fatherIds.add(parents.father_id);
        }
        if (parents.mother_id) {
          inLawIds.add(parents.mother_id);
          motherIds.add(parents.mother_id);
        }
      }
    }

    const missing = [...inLawIds].filter((id) => !byId.has(id));
    if (missing.length > 0) {
      const persons = await fcAccessRepository.findPersonsByIds(ctx.familyId, missing);
      for (const p of persons) {
        let relationLabel: string | null = null;
        if (fatherIds.has(p.id)) relationLabel = 'Mertua (ayah)';
        else if (motherIds.has(p.id)) relationLabel = 'Mertua (ibu)';
        byId.set(p.id, {
          personId: p.id,
          fullName: p.full_name,
          nickname: p.nickname,
          photoUrl: p.photo_url,
          gender: p.gender,
          kind: 'in_law',
          relationLabel,
        });
      }
    }

    return [...byId.values()].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'core' ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, 'id');
    });
  }
}

export const membersService = new MembersService();
