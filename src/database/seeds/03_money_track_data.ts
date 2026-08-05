import type { Knex } from 'knex';
import { Tables } from '../../shared/database/tables';
import {
  CASH_ACCOUNT_NAME,
  CASH_POCKET_NAME,
  DEFAULT_POCKETS,
  SEED_EXPENSE_CATEGORIES,
  SEED_INCOME_CATEGORIES,
} from '../../modules/money-track/money.constants';

/**
 * Dummy Money Track data for Irfan (me) + Ayu (me-sp).
 * Idempotent: skips if Irfan already has an mt_persons.user_id link.
 */
export async function seed(knex: Knex): Promise<void> {
  const irfan = await knex(Tables.PERSONS)
    .where({ full_name: 'Mochamad Irfani Ardhyansah' })
    .whereNull('deleted_at')
    .first<{ id: number; family_id: number }>();
  const ayu = await knex(Tables.PERSONS)
    .where({ full_name: 'Hj. Ayu Kirana' })
    .whereNull('deleted_at')
    .first<{ id: number; family_id: number }>();

  if (!irfan || !ayu) {
    console.warn('[money seed] Irfan/Ayu not found — skip (run family seed first).');
    return;
  }

  const existing = await knex(Tables.MONEY_PERSONS).where({ user_id: irfan.id }).first();
  if (existing) {
    console.log('[money seed] Money workspace for Irfan already exists — skip.');
    return;
  }

  const familyId = irfan.family_id;

  await knex.transaction(async (trx) => {
    const [workspaceId] = await trx(Tables.MONEY_WORKSPACES).insert({
      family_id: familyId,
      mode: 'couple',
      couple_linked_at: trx.fn.now(),
      has_sample_data: true,
    });

    const [irfanMoneyId] = await trx(Tables.MONEY_PERSONS).insert({
      workspace_id: workspaceId,
      name: 'Irfan',
      role: 'husband',
      user_id: irfan.id,
      family_roots_person_id: irfan.id,
    });
    const [ayuMoneyId] = await trx(Tables.MONEY_PERSONS).insert({
      workspace_id: workspaceId,
      name: 'Ayu',
      role: 'wife',
      user_id: ayu.id,
      family_roots_person_id: ayu.id,
    });

    await trx(Tables.MONEY_COUPLE_LINKS).insert({
      workspace_id: workspaceId,
      person_a_id: irfanMoneyId,
      person_b_id: ayuMoneyId,
    });

    // Categories
    const categoryRows: Array<{
      workspace_id: number;
      name: string;
      type: 'income' | 'expense';
      sort_order: number;
      is_system: boolean;
    }> = [];
    SEED_EXPENSE_CATEGORIES.forEach((name, i) => {
      categoryRows.push({
        workspace_id: workspaceId,
        name,
        type: 'expense',
        sort_order: i + 1,
        is_system: true,
      });
    });
    SEED_INCOME_CATEGORIES.forEach((name, i) => {
      categoryRows.push({
        workspace_id: workspaceId,
        name,
        type: 'income',
        sort_order: i + 1,
        is_system: true,
      });
    });
    await trx(Tables.MONEY_CATEGORIES).insert(categoryRows);

    const categories = await trx(Tables.MONEY_CATEGORIES)
      .where({ workspace_id: workspaceId })
      .select<{ id: number; name: string; type: string }[]>('id', 'name', 'type');
    const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null;

    async function createCash(personId: number) {
      const [accountId] = await trx(Tables.MONEY_ACCOUNTS).insert({
        workspace_id: workspaceId,
        person_id: personId,
        name: CASH_ACCOUNT_NAME,
        type: 'cash',
        bank_name: null,
      });
      const [pocketId] = await trx(Tables.MONEY_POCKETS).insert({
        workspace_id: workspaceId,
        account_id: accountId,
        owner_type: 'person',
        owner_person_id: personId,
        category: 'transaksi',
        name: CASH_POCKET_NAME,
        is_system: true,
      });
      return { accountId, pocketId };
    }

    async function createBankWithPockets(
      personId: number,
      name: string,
      bankName: string,
    ) {
      const [accountId] = await trx(Tables.MONEY_ACCOUNTS).insert({
        workspace_id: workspaceId,
        person_id: personId,
        name,
        type: 'bank',
        bank_name: bankName,
      });
      const pocketIds: Record<string, number> = {};
      for (const def of DEFAULT_POCKETS) {
        const [pid] = await trx(Tables.MONEY_POCKETS).insert({
          workspace_id: workspaceId,
          account_id: accountId,
          owner_type: 'person',
          owner_person_id: personId,
          category: def.category,
          name: def.name,
          is_system: false,
        });
        pocketIds[def.category] = pid;
      }
      return { accountId, pocketIds };
    }

    const irfanCash = await createCash(irfanMoneyId);
    const ayuCash = await createCash(ayuMoneyId);
    const irfanBank = await createBankWithPockets(irfanMoneyId, 'BCA Irfan', 'BCA');
    const ayuBank = await createBankWithPockets(ayuMoneyId, 'BCA Ayu', 'BCA');

    // Joint emergency pocket on Irfan's bank
    const [jointPocketId] = await trx(Tables.MONEY_POCKETS).insert({
      workspace_id: workspaceId,
      account_id: irfanBank.accountId,
      owner_type: 'joint',
      owner_person_id: null,
      category: 'tabungan',
      name: 'Dana Darurat',
      goal_amount: 60_000_000,
      goal_date: '2026-12-31',
      is_system: false,
    });

    const irfanTxn = irfanBank.pocketIds.transaksi!;
    const irfanTabungan = irfanBank.pocketIds.tabungan!;
    const ayuTxn = ayuBank.pocketIds.transaksi!;
    const ayuTabungan = ayuBank.pocketIds.tabungan!;

    // Opening balances
    const openings: Array<{ pocketId: number; amount: number }> = [
      { pocketId: irfanTxn, amount: 8_450_000 },
      { pocketId: irfanTabungan, amount: 45_000_000 },
      { pocketId: irfanBank.pocketIds.investasi!, amount: 25_000_000 },
      { pocketId: ayuTxn, amount: 5_200_000 },
      { pocketId: ayuTabungan, amount: 30_000_000 },
      { pocketId: ayuBank.pocketIds.investasi!, amount: 12_000_000 },
      { pocketId: jointPocketId, amount: 34_500_000 },
      { pocketId: irfanCash.pocketId, amount: 500_000 },
      { pocketId: ayuCash.pocketId, amount: 300_000 },
    ];

    for (const ob of openings) {
      await trx(Tables.MONEY_TRANSACTIONS).insert({
        workspace_id: workspaceId,
        pocket_id: ob.pocketId,
        category_id: null,
        type: 'opening_balance',
        amount: ob.amount,
        date: '2026-07-01',
        note: 'Opening balance',
        created_by_person_id: irfanMoneyId,
      });
    }

    // Sample July transactions
    const txns: Array<{
      pocketId: number;
      categoryId: number | null;
      type: 'income' | 'expense';
      amount: number;
      date: string;
      note: string;
      by: number;
    }> = [
      {
        pocketId: irfanTxn,
        categoryId: cat('Gaji'),
        type: 'income',
        amount: 15_000_000,
        date: '2026-07-01',
        note: 'Gaji Juli',
        by: irfanMoneyId,
      },
      {
        pocketId: ayuTxn,
        categoryId: cat('Gaji'),
        type: 'income',
        amount: 9_500_000,
        date: '2026-07-01',
        note: 'Gaji Juli Ayu',
        by: ayuMoneyId,
      },
      {
        pocketId: irfanTxn,
        categoryId: cat('Makan'),
        type: 'expense',
        amount: 85_000,
        date: '2026-07-26',
        note: 'Makan siang',
        by: irfanMoneyId,
      },
      {
        pocketId: irfanTxn,
        categoryId: cat('Transport'),
        type: 'expense',
        amount: 150_000,
        date: '2026-07-20',
        note: 'Bensin',
        by: irfanMoneyId,
      },
      {
        pocketId: ayuTxn,
        categoryId: cat('Belanja'),
        type: 'expense',
        amount: 450_000,
        date: '2026-07-18',
        note: 'Belanja bulanan',
        by: ayuMoneyId,
      },
      {
        pocketId: ayuTxn,
        categoryId: cat('Tagihan'),
        type: 'expense',
        amount: 350_000,
        date: '2026-07-10',
        note: 'Listrik + air',
        by: ayuMoneyId,
      },
      {
        pocketId: irfanTxn,
        categoryId: cat('Hiburan'),
        type: 'expense',
        amount: 200_000,
        date: '2026-07-15',
        note: 'Nonton bioskop',
        by: irfanMoneyId,
      },
    ];

    for (const t of txns) {
      await trx(Tables.MONEY_TRANSACTIONS).insert({
        workspace_id: workspaceId,
        pocket_id: t.pocketId,
        category_id: t.categoryId,
        type: t.type,
        amount: t.amount,
        date: t.date,
        note: t.note,
        created_by_person_id: t.by,
      });
    }

    // Interpersonal transfer Irfan → Ayu
    await trx(Tables.MONEY_TRANSFERS).insert({
      workspace_id: workspaceId,
      kind: 'interpersonal',
      from_pocket_id: irfanTxn,
      to_pocket_id: ayuTxn,
      amount: 3_000_000,
      date: '2026-07-05',
      note: 'Uang belanja bulan ini',
      created_by_person_id: irfanMoneyId,
    });

    // Interpocket to joint
    await trx(Tables.MONEY_TRANSFERS).insert({
      workspace_id: workspaceId,
      kind: 'interpocket',
      from_pocket_id: irfanTabungan,
      to_pocket_id: jointPocketId,
      amount: 2_000_000,
      date: '2026-07-08',
      note: 'Tambah dana darurat',
      created_by_person_id: irfanMoneyId,
    });

    // Cash withdrawal
    await trx(Tables.MONEY_CASH_WITHDRAWALS).insert({
      workspace_id: workspaceId,
      from_account_id: irfanBank.accountId,
      from_pocket_id: irfanTxn,
      to_cash_account_id: irfanCash.accountId,
      to_cash_pocket_id: irfanCash.pocketId,
      amount: 500_000,
      date: '2026-07-24',
      note: 'Buat bayar tukang',
      created_by_person_id: irfanMoneyId,
    });

    // Wishlist
    await trx(Tables.MONEY_WISHLIST_ITEMS).insert([
      {
        workspace_id: workspaceId,
        person_id: null,
        name: 'Vacuum cleaner',
        estimated_price: 2_500_000,
        priority: 'medium',
        linked_pocket_id: jointPocketId,
      },
      {
        workspace_id: workspaceId,
        person_id: ayuMoneyId,
        name: 'Kamera mirrorless',
        estimated_price: 12_000_000,
        priority: 'high',
        linked_pocket_id: ayuBank.pocketIds.tabungan!,
      },
      {
        workspace_id: workspaceId,
        person_id: irfanMoneyId,
        name: 'Sepeda lipat',
        estimated_price: 4_500_000,
        priority: 'low',
        linked_pocket_id: null,
      },
    ]);

    // Debts
    const [debtId] = await trx(Tables.MONEY_DEBTS).insert({
      workspace_id: workspaceId,
      person_id: irfanMoneyId,
      counterparty_name: 'Budi',
      direction: 'piutang',
      amount: 1_000_000,
      date: '2026-07-01',
      due_date: '2026-08-01',
      status: 'partial',
      note: 'Pinjaman ke Budi',
    });
    await trx(Tables.MONEY_DEBT_PAYMENTS).insert({
      workspace_id: workspaceId,
      debt_id: debtId,
      amount: 200_000,
      date: '2026-07-15',
      note: 'Cicilan 1',
      created_by_person_id: irfanMoneyId,
    });

    await trx(Tables.MONEY_DEBTS).insert({
      workspace_id: workspaceId,
      person_id: ayuMoneyId,
      counterparty_name: 'Bank XYZ',
      direction: 'utang',
      amount: 5_000_000,
      date: '2026-06-01',
      due_date: '2026-08-15',
      status: 'open',
      note: 'Cicilan gadget',
    });

    // Budgets July
    const makanId = cat('Makan');
    const transportId = cat('Transport');
    const belanjaId = cat('Belanja');
    if (makanId && transportId && belanjaId) {
      await trx(Tables.MONEY_BUDGETS).insert([
        {
          workspace_id: workspaceId,
          category_id: makanId,
          year_month: '2026-07',
          limit_amount: 2_000_000,
        },
        {
          workspace_id: workspaceId,
          category_id: transportId,
          year_month: '2026-07',
          limit_amount: 1_000_000,
        },
        {
          workspace_id: workspaceId,
          category_id: belanjaId,
          year_month: '2026-07',
          limit_amount: 3_000_000,
        },
      ]);
    }

    await trx(Tables.MONEY_AUDIT_LOGS).insert({
      workspace_id: workspaceId,
      actor_person_id: irfanMoneyId,
      action: 'create',
      entity_type: 'transaction',
      entity_id: 1,
      before: null,
      after: JSON.stringify({ note: 'seed bootstrap' }),
    });
  });

  console.log('[money seed] Workspace couple Irfan + Ayu created with dummy ledger.');
}
