import type { Knex } from 'knex';
import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import {
  CASH_ACCOUNT_NAME,
  CASH_POCKET_NAME,
  DEFAULT_POCKETS,
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
} from '../money.constants';
import type {
  MoneyAccountRow,
  MoneyCategoryRow,
  MoneyCoupleLinkRow,
  MoneyPersonRow,
  MoneyPocketRow,
  MoneyWorkspaceRow,
} from '../money.types';

export class SetupRepository {
  async findPersonByUserId(userId: number, trx?: Knex.Transaction): Promise<MoneyPersonRow | undefined> {
    const q = trx ?? db;
    return q(Tables.MONEY_PERSONS).where({ user_id: userId }).first<MoneyPersonRow>('*');
  }

  async createWorkspace(
    input: {
      familyId: number;
      mode: 'single' | 'couple';
      coupleLinkedAt: Date | null;
      hasSampleData?: boolean;
    },
    trx: Knex.Transaction,
  ): Promise<MoneyWorkspaceRow> {
    const [id] = await trx(Tables.MONEY_WORKSPACES).insert({
      family_id: input.familyId,
      mode: input.mode,
      couple_linked_at: input.coupleLinkedAt,
      has_sample_data: input.hasSampleData ?? false,
    });
    const row = await trx(Tables.MONEY_WORKSPACES).where({ id }).first<MoneyWorkspaceRow>('*');
    return row!;
  }

  async updateWorkspace(
    workspaceId: number,
    patch: Partial<{
      mode: 'single' | 'couple';
      couple_linked_at: Date | null;
      has_sample_data: boolean;
    }>,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const q = trx ?? db;
    await q(Tables.MONEY_WORKSPACES).where({ id: workspaceId }).update({
      ...patch,
      updated_at: q.fn.now(),
    });
  }

  async createPerson(
    input: {
      workspaceId: number;
      name: string;
      role: string;
      userId: number | null;
      familyRootsPersonId: number | null;
    },
    trx: Knex.Transaction,
  ): Promise<MoneyPersonRow> {
    const [id] = await trx(Tables.MONEY_PERSONS).insert({
      workspace_id: input.workspaceId,
      name: input.name,
      role: input.role,
      user_id: input.userId,
      family_roots_person_id: input.familyRootsPersonId,
    });
    const row = await trx(Tables.MONEY_PERSONS).where({ id }).first<MoneyPersonRow>('*');
    return row!;
  }

  async createCoupleLink(
    input: { workspaceId: number; personAId: number; personBId: number },
    trx?: Knex.Transaction,
  ): Promise<MoneyCoupleLinkRow> {
    const q = trx ?? db;
    const [id] = await q(Tables.MONEY_COUPLE_LINKS).insert({
      workspace_id: input.workspaceId,
      person_a_id: input.personAId,
      person_b_id: input.personBId,
    });
    const row = await q(Tables.MONEY_COUPLE_LINKS)
      .where({ id })
      .first<MoneyCoupleLinkRow>('*');
    return row!;
  }

  async findCoupleLink(workspaceId: number): Promise<MoneyCoupleLinkRow | undefined> {
    return db(Tables.MONEY_COUPLE_LINKS)
      .where({ workspace_id: workspaceId })
      .first<MoneyCoupleLinkRow>('*');
  }

  async deleteCoupleLink(workspaceId: number, trx?: Knex.Transaction): Promise<number> {
    const q = trx ?? db;
    return q(Tables.MONEY_COUPLE_LINKS).where({ workspace_id: workspaceId }).del();
  }

  async seedCategories(workspaceId: number, trx: Knex.Transaction): Promise<void> {
    const rows: Array<{
      workspace_id: number;
      name: string;
      type: 'income' | 'expense';
      sort_order: number;
      is_system: boolean;
    }> = [];

    SEED_EXPENSE_CATEGORIES.forEach((name, i) => {
      rows.push({
        workspace_id: workspaceId,
        name,
        type: 'expense',
        sort_order: i + 1,
        is_system: true,
      });
    });
    SEED_INCOME_CATEGORIES.forEach((name, i) => {
      rows.push({
        workspace_id: workspaceId,
        name,
        type: 'income',
        sort_order: i + 1,
        is_system: true,
      });
    });

    await trx(Tables.MONEY_CATEGORIES).insert(rows);
  }

  async createCashAccountWithPocket(
    input: { workspaceId: number; personId: number },
    trx: Knex.Transaction,
  ): Promise<{ account: MoneyAccountRow; pocket: MoneyPocketRow }> {
    const [accountId] = await trx(Tables.MONEY_ACCOUNTS).insert({
      workspace_id: input.workspaceId,
      person_id: input.personId,
      name: CASH_ACCOUNT_NAME,
      type: 'cash',
      bank_name: null,
    });
    const account = (await trx(Tables.MONEY_ACCOUNTS)
      .where({ id: accountId })
      .first<MoneyAccountRow>('*'))!;

    const [pocketId] = await trx(Tables.MONEY_POCKETS).insert({
      workspace_id: input.workspaceId,
      account_id: account.id,
      owner_type: 'person',
      owner_person_id: input.personId,
      category: 'transaksi',
      name: CASH_POCKET_NAME,
      goal_amount: null,
      goal_date: null,
      is_system: true,
      archived_at: null,
    });
    const pocket = (await trx(Tables.MONEY_POCKETS)
      .where({ id: pocketId })
      .first<MoneyPocketRow>('*'))!;

    return { account, pocket };
  }

  async createDefaultPocketsForAccount(
    input: { workspaceId: number; accountId: number; ownerPersonId: number },
    trx?: Knex.Transaction,
  ): Promise<MoneyPocketRow[]> {
    const q = trx ?? db;
    const created: MoneyPocketRow[] = [];
    for (const def of DEFAULT_POCKETS) {
      const [id] = await q(Tables.MONEY_POCKETS).insert({
        workspace_id: input.workspaceId,
        account_id: input.accountId,
        owner_type: 'person',
        owner_person_id: input.ownerPersonId,
        category: def.category,
        name: def.name,
        goal_amount: null,
        goal_date: null,
        is_system: false,
        archived_at: null,
      });
      const row = (await q(Tables.MONEY_POCKETS).where({ id }).first<MoneyPocketRow>('*'))!;
      created.push(row);
    }
    return created;
  }

  async countOpeningBalances(workspaceId: number): Promise<number> {
    const row = await db(Tables.MONEY_TRANSACTIONS)
      .where({ workspace_id: workspaceId, type: 'opening_balance' })
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async countActiveNonCashAccounts(workspaceId: number, personId: number): Promise<number> {
    const row = await db(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId, person_id: personId })
      .whereIn('type', ['bank', 'ewallet'])
      .count<{ total: number | string }>({ total: '*' })
      .first();
    return Number(row?.total ?? 0);
  }

  async archiveJointPockets(workspaceId: number, trx?: Knex.Transaction): Promise<number> {
    const q = trx ?? db;
    return q(Tables.MONEY_POCKETS)
      .where({ workspace_id: workspaceId, owner_type: 'joint' })
      .whereNull('archived_at')
      .update({ archived_at: q.fn.now(), updated_at: q.fn.now() });
  }

  async updatePersonFamilyRoots(
    personId: number,
    familyRootsPersonId: number | null,
    trx?: Knex.Transaction,
  ): Promise<void> {
    const q = trx ?? db;
    await q(Tables.MONEY_PERSONS).where({ id: personId }).update({
      family_roots_person_id: familyRootsPersonId,
      updated_at: q.fn.now(),
    });
  }

  async listCategories(workspaceId: number): Promise<MoneyCategoryRow[]> {
    return db(Tables.MONEY_CATEGORIES)
      .where({ workspace_id: workspaceId })
      .whereNull('deleted_at')
      .orderBy('type', 'asc')
      .orderBy('sort_order', 'asc')
      .select<MoneyCategoryRow[]>('*');
  }

  /**
   * Tables wiped when keepSetup=true (workspace + persons + couple_links retained).
   * Order is child → parent for readability; FK checks are disabled during wipe.
   */
  private static readonly WIPE_LEDGER_TABLES = [
    Tables.MONEY_AUDIT_LOGS,
    Tables.MONEY_DEBT_PAYMENTS,
    Tables.MONEY_DEBTS,
    Tables.MONEY_BUDGETS,
    Tables.MONEY_WISHLIST_ITEMS,
    Tables.MONEY_CASH_WITHDRAWALS,
    Tables.MONEY_TRANSFERS,
    Tables.MONEY_TRANSACTIONS,
    Tables.MONEY_POCKETS,
    Tables.MONEY_ACCOUNTS,
    Tables.MONEY_CATEGORIES,
  ] as const;

  /**
   * Wipe money ledger/structure for a workspace but keep workspace + persons + couple_links.
   * Returns deleted row counts per table.
   */
  async wipeKeepSetup(
    workspaceId: number,
    trx: Knex.Transaction,
  ): Promise<Record<string, number>> {
    const pocketIds = await trx(Tables.MONEY_POCKETS)
      .where({ workspace_id: workspaceId })
      .pluck<number[]>('id');
    const accountIds = await trx(Tables.MONEY_ACCOUNTS)
      .where({ workspace_id: workspaceId })
      .pluck<number[]>('id');

    const deleted: Record<string, number> = {};

    await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
    try {
      // Also clear ledger rows that reference this workspace's pockets/accounts
      // even if workspace_id were inconsistent (defensive).
      if (pocketIds.length > 0) {
        deleted.transactions_by_pocket = await trx(Tables.MONEY_TRANSACTIONS)
          .whereIn('pocket_id', pocketIds)
          .del();
        deleted.transfers_by_pocket = await trx(Tables.MONEY_TRANSFERS)
          .where((qb) => {
            void qb.whereIn('from_pocket_id', pocketIds).orWhereIn('to_pocket_id', pocketIds);
          })
          .del();
        deleted.cash_by_pocket = await trx(Tables.MONEY_CASH_WITHDRAWALS)
          .where((qb) => {
            void qb
              .whereIn('from_pocket_id', pocketIds)
              .orWhereIn('to_cash_pocket_id', pocketIds);
          })
          .del();
        await trx(Tables.MONEY_WISHLIST_ITEMS)
          .whereIn('linked_pocket_id', pocketIds)
          .update({ linked_pocket_id: null });
      }
      if (accountIds.length > 0) {
        deleted.cash_by_account = await trx(Tables.MONEY_CASH_WITHDRAWALS)
          .where((qb) => {
            void qb
              .whereIn('from_account_id', accountIds)
              .orWhereIn('to_cash_account_id', accountIds);
          })
          .del();
      }

      for (const table of SetupRepository.WIPE_LEDGER_TABLES) {
        const count = await trx(table).where({ workspace_id: workspaceId }).del();
        deleted[table] = (deleted[table] ?? 0) + count;
      }
    } finally {
      await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    }

    await this.assertLedgerEmpty(workspaceId, trx);
    return deleted;
  }

  /** Delete entire workspace including persons / couple_links. */
  async deleteWorkspace(
    workspaceId: number,
    trx: Knex.Transaction,
  ): Promise<Record<string, number>> {
    const deleted = await this.wipeKeepSetup(workspaceId, trx);

    await trx.raw('SET FOREIGN_KEY_CHECKS = 0');
    try {
      deleted[Tables.MONEY_COUPLE_LINKS] = await trx(Tables.MONEY_COUPLE_LINKS)
        .where({ workspace_id: workspaceId })
        .del();
      deleted[Tables.MONEY_PERSONS] = await trx(Tables.MONEY_PERSONS)
        .where({ workspace_id: workspaceId })
        .del();
      deleted[Tables.MONEY_WORKSPACES] = await trx(Tables.MONEY_WORKSPACES)
        .where({ id: workspaceId })
        .del();
    } finally {
      await trx.raw('SET FOREIGN_KEY_CHECKS = 1');
    }

    return deleted;
  }

  private async assertLedgerEmpty(
    workspaceId: number,
    trx: Knex.Transaction,
  ): Promise<void> {
    for (const table of SetupRepository.WIPE_LEDGER_TABLES) {
      const row = await trx(table)
        .where({ workspace_id: workspaceId })
        .count<{ count: number | string }[]>({ count: '*' })
        .first();
      const remaining = Number(row?.count ?? 0);
      if (remaining > 0) {
        throw new Error(
          `Money workspace reset incomplete: ${table} still has ${remaining} row(s) for workspace ${workspaceId}.`,
        );
      }
    }
  }
}

export const setupRepository = new SetupRepository();
