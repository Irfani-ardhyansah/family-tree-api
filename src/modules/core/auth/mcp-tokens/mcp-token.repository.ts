import db from '../../../../config/database';
import { Tables } from '../../../../shared/database/tables';
import {
  McpTokenRow,
  McpTokenStatusFilter,
} from './mcp-token.types';

export type ListFamilyMcpTokensFilters = {
  personId?: number;
  status: McpTokenStatusFilter;
  limit?: number;
};

export type InsertMcpTokenInput = {
  familyId: number;
  personId: number;
  label: string;
  tokenHash: string;
  tokenHint: string;
  unlockModules: string[];
};

export class McpTokenRepository {
  async countActiveByPerson(personId: number): Promise<number> {
    const row = await db(Tables.MCP_TOKENS)
      .where({ person_id: personId })
      .whereNull('revoked_at')
      .andWhere(function activeOnly() {
        this.whereNull('expires_at').orWhere('expires_at', '>', db.fn.now());
      })
      .count<{ total: number | string }[]>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async listByPerson(personId: number): Promise<McpTokenRow[]> {
    return db(Tables.MCP_TOKENS)
      .where({ person_id: personId })
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(100)
      .select<McpTokenRow[]>('*');
  }

  async listByFamily(
    familyId: number,
    filters: ListFamilyMcpTokensFilters,
  ): Promise<McpTokenRow[]> {
    const query = db(`${Tables.MCP_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .where('t.family_id', familyId)
      .whereNull('p.deleted_at')
      .select<McpTokenRow[]>([
        't.id',
        't.family_id',
        't.person_id',
        't.label',
        't.token_hash',
        't.token_hint',
        't.unlock_modules',
        't.last_used_at',
        't.expires_at',
        't.revoked_at',
        't.created_at',
        'p.full_name as person_name',
      ])
      .orderBy('t.created_at', 'desc')
      .orderBy('t.id', 'desc')
      .limit(filters.limit ?? 200);

    if (filters.personId != null) {
      query.andWhere('t.person_id', filters.personId);
    }
    if (filters.status === 'active') {
      query.whereNull('t.revoked_at').andWhere(function activeOnly() {
        this.whereNull('t.expires_at').orWhere('t.expires_at', '>', db.fn.now());
      });
    } else if (filters.status === 'revoked') {
      query.whereNotNull('t.revoked_at');
    }

    return query;
  }

  async findById(id: number): Promise<McpTokenRow | undefined> {
    return db(Tables.MCP_TOKENS).where({ id }).first<McpTokenRow>('*');
  }

  async findOwned(personId: number, id: number): Promise<McpTokenRow | undefined> {
    return db(Tables.MCP_TOKENS)
      .where({ id, person_id: personId })
      .first<McpTokenRow>('*');
  }

  async findInFamily(familyId: number, id: number): Promise<McpTokenRow | undefined> {
    return db(`${Tables.MCP_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .where('t.id', id)
      .where('t.family_id', familyId)
      .whereNull('p.deleted_at')
      .first<McpTokenRow>([
        't.id',
        't.family_id',
        't.person_id',
        't.label',
        't.token_hash',
        't.token_hint',
        't.unlock_modules',
        't.last_used_at',
        't.expires_at',
        't.revoked_at',
        't.created_at',
        'p.full_name as person_name',
      ]);
  }

  async findActiveByHash(tokenHash: string): Promise<McpTokenRow | undefined> {
    return db(`${Tables.MCP_TOKENS} as t`)
      .innerJoin(`${Tables.PERSONS} as p`, 'p.id', 't.person_id')
      .where('t.token_hash', tokenHash)
      .whereNull('t.revoked_at')
      .andWhere(function activeOnly() {
        this.whereNull('t.expires_at').orWhere('t.expires_at', '>', db.fn.now());
      })
      .whereNull('p.deleted_at')
      .where('p.status', 'alive')
      .first<McpTokenRow>([
        't.id',
        'p.family_id as family_id',
        't.person_id',
        't.label',
        't.token_hash',
        't.token_hint',
        't.unlock_modules',
        't.last_used_at',
        't.expires_at',
        't.revoked_at',
        't.created_at',
      ]);
  }

  async insert(input: InsertMcpTokenInput): Promise<McpTokenRow> {
    const [id] = await db(Tables.MCP_TOKENS).insert({
      family_id: input.familyId,
      person_id: input.personId,
      label: input.label,
      token_hash: input.tokenHash,
      token_hint: input.tokenHint,
      unlock_modules: JSON.stringify(input.unlockModules),
    });

    const row = await this.findById(Number(id));
    if (!row) {
      throw new Error('Gagal membaca token MCP setelah insert.');
    }
    return row;
  }

  async revokeById(id: number): Promise<number> {
    return db(Tables.MCP_TOKENS)
      .where({ id })
      .whereNull('revoked_at')
      .update({ revoked_at: db.fn.now() });
  }

  async touchLastUsed(id: number): Promise<void> {
    await db(Tables.MCP_TOKENS).where({ id }).update({ last_used_at: db.fn.now() });
  }
}

export const mcpTokenRepository = new McpTokenRepository();
