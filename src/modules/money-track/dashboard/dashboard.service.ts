import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asNumber,
  parseEnum,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { computePocketBalances } from '../money.balance';
import { cashWithdrawalsRepository } from '../cash-withdrawals/cash-withdrawals.repository';
import { MONEY_DASHBOARD_SCOPES } from '../money.constants';
import {
  changePercent,
  jakartaYearMonth,
  monthDateRange,
  parseYearMonth,
  previousYearMonth,
  yearMonthLabel,
} from '../money.helpers';
import type { MoneyDashboardResponse, MoneyTransactionRow } from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';
import { buildMoneyReminders } from '../reminders/reminders.service';
import { transfersRepository } from '../transfers/transfers.repository';

function formatDayMonth(dateStr: string): string {
  const d = new Date(`${toDateOnly(dateStr)}T00:00:00.000Z`);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(d);
}

export class MoneyDashboardService {
  async get(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyDashboardResponse> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const yearMonth =
      query.period === undefined
        ? jakartaYearMonth()
        : parseYearMonth(query.period, 'period');

    let scope =
      query.scope === undefined
        ? ('all' as const)
        : parseEnum(query.scope, 'scope', MONEY_DASHBOARD_SCOPES);

    if (ctx.workspace.mode === 'single') {
      scope = 'all';
    }

    let filterPersonId: number | undefined;
    if (scope === 'person') {
      filterPersonId = parsePositiveInt(query.personId, 'personId');
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        filterPersonId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }

    const { from, to } = monthDateRange(yearMonth);
    const prevYm = previousYearMonth(yearMonth);
    const prevRange = monthDateRange(prevYm);

    const [income, expense, prevIncome, prevExpense] = await Promise.all([
      this.sumTxn(ctx.workspace.id, 'income', from, to, filterPersonId),
      this.sumTxn(ctx.workspace.id, 'expense', from, to, filterPersonId),
      this.sumTxn(ctx.workspace.id, 'income', prevRange.from, prevRange.to, filterPersonId),
      this.sumTxn(ctx.workspace.id, 'expense', prevRange.from, prevRange.to, filterPersonId),
    ]);

    const allPersons = await moneyAccessRepository.listPersons(ctx.workspace.id);
    const persons = filterPersonId
      ? allPersons.filter((p) => p.id === filterPersonId)
      : allPersons;

    const allPockets = await pocketsRepository.list(ctx.workspace.id, {});
    const accounts = await pocketsRepository.findAccountsByIds(
      ctx.workspace.id,
      [...new Set(allPockets.map((p) => p.account_id))],
    );
    const accountMap = new Map(accounts.map((a) => [a.id, a]));
    const balances = await computePocketBalances(allPockets.map((p) => p.id));

    const scopedPockets = filterPersonId
      ? allPockets.filter(
          (p) => p.owner_type === 'person' && p.owner_person_id === filterPersonId,
        )
      : allPockets;

    const totalSavings = scopedPockets.reduce(
      (sum, p) => sum + (balances.get(p.id) ?? 0),
      0,
    );

    const personDtos = persons.map((person) => {
      const personPockets = allPockets.filter(
        (p) => p.owner_type === 'person' && p.owner_person_id === person.id,
      );
      const totalBalance = personPockets.reduce(
        (sum, p) => sum + (balances.get(p.id) ?? 0),
        0,
      );
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        initial: person.name.trim().charAt(0).toUpperCase() || '?',
        totalBalance,
        pockets: personPockets.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          balance: balances.get(p.id) ?? 0,
          accountName: accountMap.get(p.account_id)?.name ?? '',
        })),
      };
    });

    const jointPockets = (
      scope === 'person'
        ? []
        : allPockets.filter((p) => p.owner_type === 'joint')
    ).map((p) => {
      const balance = balances.get(p.id) ?? 0;
      const goalAmount = asNumber(p.goal_amount);
      const progressPct =
        goalAmount != null && goalAmount > 0
          ? Math.min(100, Math.round((balance / goalAmount) * 100))
          : null;
      return {
        id: p.id,
        name: p.name,
        balance,
        goalAmount,
        goalDate: p.goal_date ? toDateOnly(p.goal_date) : null,
        progressPct,
      };
    });

    const recentActivity = await this.buildRecentActivity(
      ctx.workspace.id,
      allPersons,
      allPockets,
      accountMap,
      filterPersonId,
    );

    const reminders = await buildMoneyReminders(ctx.workspace.id);
    // alerts reserved for balance_mismatch etc. — jangan duplikasi debt/budget dari reminders
    const alerts: MoneyDashboardResponse['alerts'] = [];

    return {
      period: { yearMonth, label: yearMonthLabel(yearMonth) },
      scope,
      mode: ctx.workspace.mode,
      summary: {
        income,
        expense,
        net: income - expense,
        incomeChangePct: changePercent(income, prevIncome),
        expenseChangePct: changePercent(expense, prevExpense),
        totalSavings,
      },
      persons: personDtos,
      jointPockets,
      recentActivity,
      alerts,
      reminders,
    };
  }

  private async sumTxn(
    workspaceId: number,
    type: 'income' | 'expense',
    from: string,
    to: string,
    personId?: number,
  ): Promise<number> {
    let q = db(Tables.MONEY_TRANSACTIONS)
      .where(`${Tables.MONEY_TRANSACTIONS}.workspace_id`, workspaceId)
      .where(`${Tables.MONEY_TRANSACTIONS}.type`, type)
      .whereBetween(`${Tables.MONEY_TRANSACTIONS}.date`, [from, to]);

    if (personId != null) {
      q = q
        .join(
          Tables.MONEY_POCKETS,
          `${Tables.MONEY_POCKETS}.id`,
          `${Tables.MONEY_TRANSACTIONS}.pocket_id`,
        )
        .where(`${Tables.MONEY_POCKETS}.owner_person_id`, personId);
    }

    const row = await q
      .sum<{ total: number | string | null }>({
        total: `${Tables.MONEY_TRANSACTIONS}.amount`,
      })
      .first();
    return asNumber(row?.total) ?? 0;
  }

  private async buildRecentActivity(
    workspaceId: number,
    persons: Awaited<ReturnType<typeof moneyAccessRepository.listPersons>>,
    pockets: Awaited<ReturnType<typeof pocketsRepository.list>>,
    accountMap: Map<number, { name: string }>,
    filterPersonId?: number,
  ): Promise<MoneyDashboardResponse['recentActivity']> {
    const personMap = new Map(persons.map((p) => [p.id, p]));
    const pocketMap = new Map(pockets.map((p) => [p.id, p]));

    const [txns, transfers, cashRows] = await Promise.all([
      db(Tables.MONEY_TRANSACTIONS)
        .where({ workspace_id: workspaceId })
        .whereIn('type', ['income', 'expense'])
        .orderBy('date', 'desc')
        .orderBy('id', 'desc')
        .limit(20)
        .select<MoneyTransactionRow[]>('*'),
      transfersRepository.listRecent(workspaceId, 20),
      cashWithdrawalsRepository.listRecent(workspaceId, 20),
    ]);

    type Activity = MoneyDashboardResponse['recentActivity'][number] & {
      sortDate: string;
      sortId: number;
    };
    const items: Activity[] = [];

    for (const t of txns) {
      const pocket = pocketMap.get(t.pocket_id);
      if (filterPersonId != null && pocket?.owner_person_id !== filterPersonId) {
        continue;
      }
      const person = pocket?.owner_person_id
        ? personMap.get(pocket.owner_person_id)
        : undefined;
      const amount = asNumber(t.amount) ?? 0;
      items.push({
        id: `txn:${t.id}`,
        kind: t.type as 'income' | 'expense',
        title: t.note || (t.type === 'income' ? 'Pemasukan' : 'Pengeluaran'),
        meta: [
          formatDayMonth(t.date),
          pocket?.name,
          person?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        amount,
        signed: t.type === 'income' ? 'pos' : 'neg',
        sortDate: toDateOnly(t.date),
        sortId: Number(t.id),
      });
    }

    for (const x of transfers) {
      const from = pocketMap.get(x.from_pocket_id);
      const to = pocketMap.get(x.to_pocket_id);
      if (
        filterPersonId != null &&
        from?.owner_person_id !== filterPersonId &&
        to?.owner_person_id !== filterPersonId
      ) {
        continue;
      }
      const amount = asNumber(x.amount) ?? 0;
      items.push({
        id: `xfer:${x.id}`,
        kind: 'transfer',
        title: x.note || 'Transfer',
        meta: [
          formatDayMonth(x.date),
          from?.name,
          '→',
          to?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        amount,
        signed: 'neutral',
        sortDate: toDateOnly(x.date),
        sortId: Number(x.id),
      });
    }

    for (const c of cashRows) {
      const from = pocketMap.get(c.from_pocket_id);
      if (filterPersonId != null && from?.owner_person_id !== filterPersonId) {
        continue;
      }
      const person = from?.owner_person_id
        ? personMap.get(from.owner_person_id)
        : undefined;
      const amount = asNumber(c.amount) ?? 0;
      items.push({
        id: `cash:${c.id}`,
        kind: 'cash_withdrawal',
        title: c.note || 'Tarik tunai',
        meta: [
          formatDayMonth(c.date),
          from?.name,
          person?.name,
          accountMap.get(c.from_account_id)?.name,
        ]
          .filter(Boolean)
          .join(' · '),
        amount,
        signed: 'neutral',
        sortDate: toDateOnly(c.date),
        sortId: Number(c.id),
      });
    }

    items.sort((a, b) => {
      if (a.sortDate !== b.sortDate) return a.sortDate < b.sortDate ? 1 : -1;
      return b.sortId - a.sortId;
    });

    return items.slice(0, 10).map(({ sortDate: _s, sortId: _i, ...rest }) => rest);
  }
}

export const moneyDashboardService = new MoneyDashboardService();
