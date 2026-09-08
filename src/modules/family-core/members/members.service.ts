import { resolveFcContext } from '../fc.access';
import type { FcMemberDto } from '../fc.types';
import { resolveNuclearMembers } from './nuclear-members';

export class MembersService {
  async list(authPersonId: number, familyId: number): Promise<FcMemberDto[]> {
    const ctx = await resolveFcContext(authPersonId, familyId);
    return resolveNuclearMembers(ctx.familyId, ctx.actorPersonId);
  }
}

export const membersService = new MembersService();
