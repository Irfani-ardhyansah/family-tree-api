import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';

/**
 * Link utang/piutang ke kantong (pocket) supaya efeknya ikut ke saldo kantong.
 *
 * - Nullable: baris lama tetap valid (`pocket_id = NULL` → tidak mengubah saldo).
 * - ON DELETE SET NULL: hapus kantong tidak menghapus catatan utang/piutang.
 * - Efek saldo dihitung derived (`money.balance.ts`), tidak menulis ke mt_transactions.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_DEBTS, (table) => {
    table.integer('pocket_id').unsigned().nullable().after('person_id');
    table
      .foreign('pocket_id', 'mt_debts_pocket_fk')
      .references('id')
      .inTable(Tables.MONEY_POCKETS)
      .onDelete('SET NULL');
    table.index(['workspace_id', 'pocket_id'], 'mt_debts_workspace_pocket_idx');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(Tables.MONEY_DEBTS, (table) => {
    table.dropForeign('pocket_id', 'mt_debts_pocket_fk');
    table.dropIndex(['workspace_id', 'pocket_id'], 'mt_debts_workspace_pocket_idx');
    table.dropColumn('pocket_id');
  });
}
