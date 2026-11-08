import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Token akses MCP per person.
 *
 * - `token_hash` = SHA-256 dari token asli. Token asli hanya dikembalikan sekali
 *   saat dibuat, tidak pernah disimpan di DB.
 * - `unlock_modules` = modul sensitif yang boleh diakses token ini tanpa
 *   `X-Module-Unlock` (mis. `["money"]`). Diisi hanya saat pembuatan token
 *   dengan verifikasi password kedua.
 * - Tidak ada expiry default; token berlaku sampai dicabut user/admin.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(Tables.MCP_TOKENS, (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.integer('family_id').unsigned().notNullable();
    table.integer('person_id').unsigned().notNullable();
    table.string('label', 60).notNullable();
    table.string('token_hash', 64).notNullable();
    table.string('token_hint', 32).notNullable();
    table.json('unlock_modules').nullable();
    table.timestamp('last_used_at').nullable();
    table.timestamp('expires_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.timestamps(true, true);

    table.foreign('family_id').references(`${Tables.FAMILIES}.id`).onDelete('CASCADE');
    table.foreign('person_id').references(`${Tables.PERSONS}.id`).onDelete('CASCADE');
    table.unique(['token_hash'], 'core_mcp_tokens_token_hash_uidx');
    table.index(['family_id', 'revoked_at'], 'core_mcp_tokens_family_revoked_idx');
    table.index(['person_id', 'revoked_at'], 'core_mcp_tokens_person_revoked_idx');
    table.index(['expires_at'], 'core_mcp_tokens_expires_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(Tables.MCP_TOKENS);
}
