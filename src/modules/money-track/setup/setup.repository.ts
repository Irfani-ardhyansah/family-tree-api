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
    input: { familyId: number; mode: 'single' | 'couple'; coupleLinkedAt: Date | null },
    trx: Knex.Transaction,
  ): Promise<MoneyWorkspaceRow> {
    const [id] = await trx(Tables.MONEY_WORKSPACES).insert({
      family_id: input.familyId,
      mode: input.mode,
      couple_linked_at: input.coupleLinkedAt,
    });
    const row = await trx(Tables.MONEY_WORKSPACES).where({ id }).first<MoneyWorkspaceRow>('*');
    return row!;
  }

  async updateWorkspace(
    workspaceId: number,
    patch: Partial<{ mode: 'single' | 'couple'; couple_linked_at: Date | null }>,
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
}

export const setupRepository = new SetupRepository();
