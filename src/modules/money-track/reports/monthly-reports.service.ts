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
import { MONEY_DASHBOARD_SCOPES } from '../money.constants';
import { debtsRepository } from '../debts/debts.repository';
import {
  changePercent1,
  eachDateInRange,
  monthDateRange,
  parseYearMonth,
  previousYearMonth,
  round1,
  yearMonthLabel,
} from '../money.helpers';
import type { MoneyMonthlyReportResponse } from '../money.types';
import { pocketsRepository } from '../pockets/pockets.repository';

type AggRow = {
  amount: number | string;
  count: number | string;
};

type DailyRow = {
  date: string;
  income: number | string;
  expense: number | string;
};

type CategoryRow = {
  category_id: number | null;
  category_name: string | null;
  amount: number | string;
  count: number | string;
};

type PocketAggRow = {
  pocket_id: number;
  income: number | string;
  expense: number | string;
};

type PersonAggRow = {
  person_id: number;
  income: number | string;
  expense: number | string;
};

type MoveRow = {
  count: number | string;
  amount: number | string;
};

export class MonthlyReportsService {
  async monthly(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyMonthlyReportResponse> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    if (query.yearMonth === undefined) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'yearMonth wajib.');
    }
    const yearMonth = parseYearMonth(query.yearMonth, 'yearMonth');

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

    const workspaceId = ctx.workspace.id;
    const { from, to } = monthDateRange(yearMonth);
    const prevYm = previousYearMonth(yearMonth);
    const prevRange = monthDateRange(prevYm);

    const [
      curIncome,
      curExpense,
      prevIncome,
      prevExpense,
      dailyRows,
      expenseCats,
      incomeCats,
      pocketRows,
      personRows,
      transferMove,
      cashMove,
      debtsOpen,
    ] = await Promise.all([
      this.sumAndCount(workspaceId, 'income', from, to, filterPersonId),
      this.sumAndCount(workspaceId, 'expense', from, to, filterPersonId),
      this.sumAndCount(workspaceId, 'income', prevRange.from, prevRange.to, filterPersonId),
      this.sumAndCount(workspaceId, 'expense', prevRange.from, prevRange.to, filterPersonId),
      this.dailyAgg(workspaceId, from, to, filterPersonId),
      this.byCategory(workspaceId, 'expense', from, to, filterPersonId),
      this.byCategory(workspaceId, 'income', from, to, filterPersonId),
      this.byPocket(workspaceId, from, to, filterPersonId),
      this.byPerson(workspaceId, from, to, filterPersonId),
      this.movesTransfer(workspaceId, from, to, filterPersonId),
      this.movesCash(workspaceId, from, to, filterPersonId),
      this.buildDebtsOpen(workspaceId, filterPersonId),
    ]);

    const income = curIncome.amount;
    const expense = curExpense.amount;
    const net = income - expense;
    const prevNet = prevIncome.amount - prevExpense.amount;
    const savingsRatePct =
      income > 0 ? round1((net / income) * 100) : 0;

    const dailyMap = new Map<string, { income: number; expense: number }>();
    for (const row of dailyRows) {
      dailyMap.set(toDateOnly(row.date), {
        income: asNumber(row.income) ?? 0,
        expense: asNumber(row.expense) ?? 0,
      });
    }

    let cumulativeNet = 0;
    const daily = eachDateInRange(from, to).map((date) => {
      const day = dailyMap.get(date) ?? { income: 0, expense: 0 };
      const dayNet = day.income - day.expense;
      cumulativeNet += dayNet;
      return {
        date,
        income: day.income,
        expense: day.expense,
        net: dayNet,
        cumulativeNet,
      };
    });

    const topExpenseDays = [...daily]
      .filter((d) => d.expense > 0)
      .sort((a, b) => b.expense - a.expense || (a.date < b.date ? 1 : -1))
      .slice(0, 5)
      .map((d) => ({ date: d.date, expense: d.expense, income: d.income }));

    const byCategoryExpense = this.mapCategoryRows(expenseCats, expense);
    const byCategoryIncome = this.mapCategoryRows(incomeCats, income);

    const persons = await moneyAccessRepository.listPersons(workspaceId);
    const personMap = new Map(persons.map((p) => [p.id, p.name]));
    const pockets = await pocketsRepository.list(workspaceId, { includeArchived: true });
    const pocketMap = new Map(pockets.map((p) => [p.id, p]));
    const accounts = await pocketsRepository.findAccountsByIds(
      workspaceId,
      [...new Set(pockets.map((p) => p.account_id))],
    );
    const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

    const byPocket = pocketRows
      .map((row) => {
        const pocket = pocketMap.get(row.pocket_id);
        const personId = pocket?.owner_person_id ?? null;
        const inc = asNumber(row.income) ?? 0;
        const exp = asNumber(row.expense) ?? 0;
        return {
          pocketId: row.pocket_id,
          pocketName: pocket?.name ?? `Pocket #${row.pocket_id}`,
          accountName: pocket ? (accountMap.get(pocket.account_id) ?? '') : '',
          personId,
          personName: personId != null ? (personMap.get(personId) ?? null) : null,
          income: inc,
          expense: exp,
          net: inc - exp,
        };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || b.expense - a.expense);

    const byPerson = personRows
      .map((row) => {
        const inc = asNumber(row.income) ?? 0;
        const exp = asNumber(row.expense) ?? 0;
        return {
          personId: row.person_id,
          personName: personMap.get(row.person_id) ?? `Person #${row.person_id}`,
          income: inc,
          expense: exp,
          net: inc - exp,
        };
      })
      .sort((a, b) => b.net - a.net);

    return {
      period: {
        yearMonth,
        label: yearMonthLabel(yearMonth),
        from,
        to,
      },
      previousPeriod: {
        yearMonth: prevYm,
        label: yearMonthLabel(prevYm),
      },
      scope,
      summary: {
        income,
        expense,
        net,
        savingsRatePct,
        incomeChangePct: changePercent1(income, prevIncome.amount),
        expenseChangePct: changePercent1(expense, prevExpense.amount),
        netChangePct: changePercent1(net, prevNet),
        txnCount: curIncome.count + curExpense.count,
        expenseTxnCount: curExpense.count,
        incomeTxnCount: curIncome.count,
      },
      previousSummary: {
        income: prevIncome.amount,
        expense: prevExpense.amount,
        net: prevNet,
      },
      daily,
      byCategory: {
        expense: byCategoryExpense,
        income: byCategoryIncome,
      },
      byPocket,
      byPerson,
      moves: {
        transfer: transferMove,
        cashWithdrawal: cashMove,
      },
      topExpenseDays,
      debtsOpen,
    };
  }

  private mapCategoryRows(
    rows: CategoryRow[],
    total: number,
  ): MoneyMonthlyReportResponse['byCategory']['expense'] {
    return rows
      .map((row) => {
        const amount = asNumber(row.amount) ?? 0;
        return {
          categoryId: row.category_id,
          categoryName: row.category_name ?? 'Tanpa kategori',
          amount,
          pct: total > 0 ? round1((amount / total) * 100) : 0,
          count: Number(row.count ?? 0),
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  private personJoin(filterPersonId?: number): {
    joinSql: string;
    whereSql: string;
    bindings: unknown[];
  } {
    if (filterPersonId == null) {
      return { joinSql: '', whereSql: '', bindings: [] };
    }
    return {
      joinSql: `INNER JOIN ${Tables.MONEY_POCKETS} p ON p.id = t.pocket_id`,
      whereSql: ` AND p.owner_person_id = ?`,
      bindings: [filterPersonId],
    };
  }

  private async sumAndCount(
    workspaceId: number,
    type: 'income' | 'expense',
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<{ amount: number; count: number }> {
    const { joinSql, whereSql, bindings } = this.personJoin(filterPersonId);
    const result = await db.raw(
      `SELECT COALESCE(SUM(t.amount), 0) AS amount, COUNT(*) AS count
       FROM ${Tables.MONEY_TRANSACTIONS} t
       ${joinSql}
       WHERE t.workspace_id = ?
         AND t.type = ?
         AND t.date >= ?
         AND t.date <= ?
         ${whereSql}`,
      [workspaceId, type, from, to, ...bindings],
    );
    const row = (result[0]?.[0] ?? result[0]) as AggRow;
    return {
      amount: asNumber(row?.amount) ?? 0,
      count: Number(row?.count ?? 0),
    };
  }

  private async dailyAgg(
    workspaceId: number,
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<DailyRow[]> {
    const { joinSql, whereSql, bindings } = this.personJoin(filterPersonId);
    const result = await db.raw(
      `SELECT t.date AS date,
              COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
       FROM ${Tables.MONEY_TRANSACTIONS} t
       ${joinSql}
       WHERE t.workspace_id = ?
         AND t.type IN ('income', 'expense')
         AND t.date >= ?
         AND t.date <= ?
         ${whereSql}
       GROUP BY t.date
       ORDER BY t.date ASC`,
      [workspaceId, from, to, ...bindings],
    );
    return (result[0] ?? result) as DailyRow[];
  }

  private async byCategory(
    workspaceId: number,
    type: 'income' | 'expense',
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<CategoryRow[]> {
    const { joinSql, whereSql, bindings } = this.personJoin(filterPersonId);
    const result = await db.raw(
      `SELECT t.category_id AS category_id,
              c.name AS category_name,
              COALESCE(SUM(t.amount), 0) AS amount,
              COUNT(*) AS count
       FROM ${Tables.MONEY_TRANSACTIONS} t
       ${joinSql}
       LEFT JOIN ${Tables.MONEY_CATEGORIES} c ON c.id = t.category_id
       WHERE t.workspace_id = ?
         AND t.type = ?
         AND t.date >= ?
         AND t.date <= ?
         ${whereSql}
       GROUP BY t.category_id, c.name
       ORDER BY amount DESC`,
      [workspaceId, type, from, to, ...bindings],
    );
    return (result[0] ?? result) as CategoryRow[];
  }

  private async byPocket(
    workspaceId: number,
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<PocketAggRow[]> {
    const { joinSql, whereSql, bindings } = this.personJoin(filterPersonId);
    const result = await db.raw(
      `SELECT t.pocket_id AS pocket_id,
              COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
       FROM ${Tables.MONEY_TRANSACTIONS} t
       ${joinSql}
       WHERE t.workspace_id = ?
         AND t.type IN ('income', 'expense')
         AND t.date >= ?
         AND t.date <= ?
         ${whereSql}
       GROUP BY t.pocket_id`,
      [workspaceId, from, to, ...bindings],
    );
    return (result[0] ?? result) as PocketAggRow[];
  }

  private async byPerson(
    workspaceId: number,
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<PersonAggRow[]> {
    let wherePerson = '';
    const bindings: unknown[] = [workspaceId, from, to];
    if (filterPersonId != null) {
      wherePerson = ' AND p.owner_person_id = ?';
      bindings.push(filterPersonId);
    }
    const result = await db.raw(
      `SELECT p.owner_person_id AS person_id,
              COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income,
              COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense
       FROM ${Tables.MONEY_TRANSACTIONS} t
       INNER JOIN ${Tables.MONEY_POCKETS} p ON p.id = t.pocket_id
       WHERE t.workspace_id = ?
         AND t.type IN ('income', 'expense')
         AND t.date >= ?
         AND t.date <= ?
         AND p.owner_person_id IS NOT NULL
         ${wherePerson}
       GROUP BY p.owner_person_id`,
      bindings,
    );
    return (result[0] ?? result) as PersonAggRow[];
  }

  private async movesTransfer(
    workspaceId: number,
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<{ count: number; amount: number }> {
    let joinSql = '';
    let whereSql = '';
    const bindings: unknown[] = [workspaceId, from, to];
    if (filterPersonId != null) {
      joinSql = `
        INNER JOIN ${Tables.MONEY_POCKETS} pf ON pf.id = x.from_pocket_id
        INNER JOIN ${Tables.MONEY_POCKETS} pt ON pt.id = x.to_pocket_id
      `;
      whereSql = ' AND (pf.owner_person_id = ? OR pt.owner_person_id = ?)';
      bindings.push(filterPersonId, filterPersonId);
    }
    const result = await db.raw(
      `SELECT COUNT(*) AS count, COALESCE(SUM(x.amount), 0) AS amount
       FROM ${Tables.MONEY_TRANSFERS} x
       ${joinSql}
       WHERE x.workspace_id = ?
         AND x.date >= ?
         AND x.date <= ?
         ${whereSql}`,
      bindings,
    );
    const row = (result[0]?.[0] ?? result[0]) as MoveRow;
    return {
      count: Number(row?.count ?? 0),
      amount: asNumber(row?.amount) ?? 0,
    };
  }

  private async movesCash(
    workspaceId: number,
    from: string,
    to: string,
    filterPersonId?: number,
  ): Promise<{ count: number; amount: number }> {
    let joinSql = '';
    let whereSql = '';
    const bindings: unknown[] = [workspaceId, from, to];
    if (filterPersonId != null) {
      joinSql = `INNER JOIN ${Tables.MONEY_POCKETS} p ON p.id = c.from_pocket_id`;
      whereSql = ' AND p.owner_person_id = ?';
      bindings.push(filterPersonId);
    }
    const result = await db.raw(
      `SELECT COUNT(*) AS count, COALESCE(SUM(c.amount), 0) AS amount
       FROM ${Tables.MONEY_CASH_WITHDRAWALS} c
       ${joinSql}
       WHERE c.workspace_id = ?
         AND c.date >= ?
         AND c.date <= ?
         ${whereSql}`,
      bindings,
    );
    const row = (result[0]?.[0] ?? result[0]) as MoveRow;
    return {
      count: Number(row?.count ?? 0),
      amount: asNumber(row?.amount) ?? 0,
    };
  }

  private async buildDebtsOpen(
    workspaceId: number,
    filterPersonId?: number,
  ): Promise<MoneyMonthlyReportResponse['debtsOpen']> {
    const rows = await db(Tables.MONEY_DEBTS)
      .where({ workspace_id: workspaceId })
      .whereIn('status', ['open', 'partial'])
      .modify((q) => {
        if (filterPersonId != null) q.where({ person_id: filterPersonId });
      })
      .select('*');

    const today = new Date().toISOString().slice(0, 10);
    const todayTime = new Date(`${today}T00:00:00.000Z`).getTime();

    let utangRemaining = 0;
    let piutangRemaining = 0;
    let dueSoonCount = 0;

    for (const debt of rows) {
      const paid = await debtsRepository.sumPayments(debt.id);
      const remaining = Math.max(0, (asNumber(debt.amount) ?? 0) - paid);
      if (debt.direction === 'utang') utangRemaining += remaining;
      else piutangRemaining += remaining;

      if (debt.due_date && remaining > 0) {
        const due = toDateOnly(debt.due_date);
        const days = Math.ceil(
          (new Date(`${due}T00:00:00.000Z`).getTime() - todayTime) / 86_400_000,
        );
        if (days <= 7) dueSoonCount += 1;
      }
    }

    return {
      utangRemaining,
      piutangRemaining,
      dueSoonCount,
      openCount: rows.length,
    };
  }
}

export const monthlyReportsService = new MonthlyReportsService();
