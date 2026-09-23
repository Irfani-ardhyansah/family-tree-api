import db from '../../../../config/database';
import { Tables } from '../../../../shared/database/tables';
import { ModuleStatusId } from '../../admin/admin.constants';
import { ChallengeKind, CredentialRow } from './webauthn.types';

const MAX_CREDENTIALS = 2;

export type InsertCredentialInput = {
  familyId: number;
  personId: number;
  label: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[] | null;
};

export type InsertCredentialResult = { ok: true; id: number } | { ok: false; reason: 'limit' | 'exists' };

function isDup(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ER_DUP_ENTRY'
  );
}

export class WebauthnRepository {
  async anyModuleEnabled(moduleId: ModuleStatusId): Promise<boolean> {
    const row = await db(Tables.MODULE_STATUSES)
      .where({ module_id: moduleId, enabled: true })
      .first('id');
    return Boolean(row);
  }

  async countByPerson(personId: number): Promise<number> {
    const row = await db(Tables.WEBAUTHN_CREDENTIALS)
      .where({ person_id: personId })
      .count<{ count: number | string }[]>({ count: '*' })
      .first();
    return Number(row?.count ?? 0);
  }

  async listCredentialIdsByPerson(personId: number): Promise<{ credentialId: string; transports: unknown }[]> {
    const rows = await db(Tables.WEBAUTHN_CREDENTIALS)
      .where({ person_id: personId })
      .select<{ credential_id: string; transports: unknown }[]>('credential_id', 'transports');
    return rows.map((row) => ({ credentialId: row.credential_id, transports: row.transports }));
  }

  async listByPerson(personId: number): Promise<CredentialRow[]> {
    return db(Tables.WEBAUTHN_CREDENTIALS)
      .where({ person_id: personId })
      .orderBy('created_at', 'asc')
      .select<CredentialRow[]>('*');
  }

  async listByFamily(familyId: number): Promise<CredentialRow[]> {
    return db(`${Tables.WEBAUTHN_CREDENTIALS} as c`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 'c.person_id')
      .where('c.family_id', familyId)
      .whereNull('p.deleted_at')
      .orderBy('p.full_name', 'asc')
      .orderBy('c.created_at', 'asc')
      .select<CredentialRow[]>(
        'c.id',
        'c.family_id',
        'c.person_id',
        'c.label',
        'c.enabled',
        'c.credential_id',
        'c.public_key',
        'c.counter',
        'c.transports',
        'c.last_used_at',
        'c.created_at',
        'p.full_name as person_name',
      );
  }

  async findByCredentialId(credentialId: string): Promise<CredentialRow | undefined> {
    return db(Tables.WEBAUTHN_CREDENTIALS).where({ credential_id: credentialId }).first<CredentialRow>();
  }

  async findOwned(personId: number, id: number): Promise<CredentialRow | undefined> {
    return db(Tables.WEBAUTHN_CREDENTIALS)
      .where({ id, person_id: personId })
      .first<CredentialRow>();
  }

  async findInFamily(familyId: number, id: number): Promise<CredentialRow | undefined> {
    return db(`${Tables.WEBAUTHN_CREDENTIALS} as c`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 'c.person_id')
      .where('c.id', id)
      .where('c.family_id', familyId)
      .whereNull('p.deleted_at')
      .first<CredentialRow>(
        'c.id',
        'c.family_id',
        'c.person_id',
        'c.label',
        'c.enabled',
        'c.credential_id',
        'c.public_key',
        'c.counter',
        'c.transports',
        'c.last_used_at',
        'c.created_at',
        'p.full_name as person_name',
      );
  }

  async findById(id: number): Promise<CredentialRow | undefined> {
    return db(Tables.WEBAUTHN_CREDENTIALS).where({ id }).first<CredentialRow>();
  }

  async insertCredential(input: InsertCredentialInput): Promise<InsertCredentialResult> {
    try {
      return await db.transaction(async (trx) => {
        await trx(Tables.PERSONS).where({ id: input.personId }).forUpdate().first();
        const countRow = await trx(Tables.WEBAUTHN_CREDENTIALS)
          .where({ person_id: input.personId })
          .count<{ count: number | string }[]>({ count: '*' })
          .first();
        if (Number(countRow?.count ?? 0) >= MAX_CREDENTIALS) {
          return { ok: false, reason: 'limit' };
        }

        const existing = await trx(Tables.WEBAUTHN_CREDENTIALS)
          .where({ credential_id: input.credentialId })
          .first('id');
        if (existing) {
          return { ok: false, reason: 'exists' };
        }

        const [id] = await trx(Tables.WEBAUTHN_CREDENTIALS).insert({
          family_id: input.familyId,
          person_id: input.personId,
          label: input.label,
          enabled: true,
          credential_id: input.credentialId,
          public_key: input.publicKey,
          counter: input.counter,
          transports: input.transports ? JSON.stringify(input.transports) : null,
        });
        return { ok: true, id: Number(id) };
      });
    } catch (error) {
      if (isDup(error)) {
        return { ok: false, reason: 'exists' };
      }
      throw error;
    }
  }

  async updateOwnedLabel(personId: number, id: number, label: string): Promise<number> {
    return db(Tables.WEBAUTHN_CREDENTIALS)
      .where({ id, person_id: personId })
      .update({ label, updated_at: db.fn.now() });
  }

  async updateInFamily(
    familyId: number,
    id: number,
    patch: { label?: string; enabled?: boolean },
  ): Promise<number> {
    const changes: Record<string, unknown> = { updated_at: db.fn.now() };
    if (patch.label !== undefined) changes.label = patch.label;
    if (patch.enabled !== undefined) changes.enabled = patch.enabled;
    return db(Tables.WEBAUTHN_CREDENTIALS).where({ id, family_id: familyId }).update(changes);
  }

  async deleteOwned(personId: number, id: number): Promise<number> {
    return db(Tables.WEBAUTHN_CREDENTIALS).where({ id, person_id: personId }).delete();
  }

  async deleteInFamily(familyId: number, id: number): Promise<number> {
    return db(Tables.WEBAUTHN_CREDENTIALS).where({ id, family_id: familyId }).delete();
  }

  async markUsed(id: number, counter: number): Promise<void> {
    await db(Tables.WEBAUTHN_CREDENTIALS).where({ id }).update({
      counter,
      last_used_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  async saveChallenge(input: {
    personId: number | null;
    kind: ChallengeKind;
    challenge: string;
    expiresAt: Date;
  }): Promise<void> {
    await db(Tables.WEBAUTHN_CHALLENGES).where('expires_at', '<', db.fn.now()).delete();
    await db(Tables.WEBAUTHN_CHALLENGES).insert({
      person_id: input.personId,
      kind: input.kind,
      challenge: input.challenge,
      expires_at: input.expiresAt,
    });
  }

  /**
   * Hapus challenge supaya sekali pakai. `false` kalau hilang, kedaluwarsa, atau kind/pemilik tidak cocok.
   */
  async consumeChallenge(input: {
    challenge: string;
    kind: ChallengeKind;
    personId: number | null;
  }): Promise<boolean> {
    return db.transaction(async (trx) => {
      const row = await trx(Tables.WEBAUTHN_CHALLENGES)
        .where({ challenge: input.challenge })
        .forUpdate()
        .select('id', 'person_id', 'kind')
        .select(trx.raw('expires_at > NOW() as fresh'))
        .first<{ id: number; person_id: number | null; kind: ChallengeKind; fresh: number | boolean }>();

      if (!row) {
        return false;
      }

      await trx(Tables.WEBAUTHN_CHALLENGES).where({ id: row.id }).delete();

      const fresh = row.fresh === true || Number(row.fresh) === 1;
      if (row.kind !== input.kind || !fresh) {
        return false;
      }
      if (
        (input.kind === 'register' || input.kind === 'unlock') &&
        Number(row.person_id) !== input.personId
      ) {
        return false;
      }
      if (input.kind === 'login' && row.person_id != null) {
        return false;
      }
      return true;
    });
  }
}

export const webauthnRepository = new WebauthnRepository();
