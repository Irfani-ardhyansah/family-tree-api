import { asNumber, toDateOnly } from '../money.access';
import { BUDGET_NEAR_THRESHOLD_PCT } from '../money.constants';
import { jakartaYearMonth, monthDateRange } from '../money.helpers';
import type { MoneyReminderDto } from '../money.types';
import { budgetsRepository } from '../budgets/budgets.repository';
import { categoriesRepository } from '../categories/categories.repository';
import { debtsRepository } from '../debts/debts.repository';

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`;
}

/**
 * Computed in-app reminders (no persistence).
 */
export async function buildMoneyReminders(
  workspaceId: number,
): Promise<MoneyReminderDto[]> {
  const reminders: MoneyReminderDto[] = [];
  const today = new Date().toISOString().slice(0, 10);

  const debts = await debtsRepository.listOpenWithDue(workspaceId);
  for (const debt of debts) {
    if (!debt.due_date) continue;
    const due = toDateOnly(debt.due_date);
    const dueTime = new Date(`${due}T00:00:00.000Z`).getTime();
    const todayTime = new Date(`${today}T00:00:00.000Z`).getTime();
    const days = Math.ceil((dueTime - todayTime) / 86_400_000);
    if (days > 7) continue;

    const paidTotal = await debtsRepository.sumPayments(debt.id);
    const remaining = Math.max(0, (asNumber(debt.amount) ?? 0) - paidTotal);
    const isPiutang = debt.direction === 'piutang';
    const label = isPiutang ? 'Piutang' : 'Utang';
    const sisaLabel = isPiutang ? 'Sisa piutang' : 'Sisa utang';
    reminders.push({
      id: `debt_due:${debt.id}`,
      type: 'debt_due',
      title: `${label} ${debt.counterparty_name} jatuh tempo`,
      body: `${sisaLabel} ${formatRp(remaining)}`,
      dueAt: `${due}T00:00:00.000Z`,
      relatedType: 'debt',
      relatedId: debt.id,
      link: `/money/debts/${debt.id}`,
    });
  }

  const yearMonth = jakartaYearMonth();
  const { from, to } = monthDateRange(yearMonth);
  const budgets = await budgetsRepository.listByMonth(workspaceId, yearMonth);
  const categories = await categoriesRepository.list(workspaceId, 'expense');
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  for (const budget of budgets) {
    const spent = await budgetsRepository.sumExpenseForCategory(
      workspaceId,
      budget.category_id,
      from,
      to,
    );
    const limit = asNumber(budget.limit_amount) ?? 0;
    if (limit <= 0) continue;
    const pct = Math.round((spent / limit) * 100);
    const name = catMap.get(budget.category_id) ?? 'Kategori';
    const budgetLink = `/money/budgets?yearMonth=${yearMonth}`;

    if (pct >= 100) {
      reminders.push({
        id: `budget_over:${budget.id}`,
        type: 'budget_over',
        title: `Budget ${name} terlampaui`,
        body: `Terpakai ${formatRp(spent)} / ${formatRp(limit)} (${pct}%)`,
        dueAt: null,
        relatedType: 'budget',
        relatedId: budget.id,
        link: budgetLink,
      });
    } else if (pct >= BUDGET_NEAR_THRESHOLD_PCT) {
      reminders.push({
        id: `budget_near:${budget.id}`,
        type: 'budget_near',
        title: `Budget ${name} hampir habis`,
        body: `Terpakai ${formatRp(spent)} / ${formatRp(limit)} (${pct}%)`,
        dueAt: null,
        relatedType: 'budget',
        relatedId: budget.id,
        link: budgetLink,
      });
    }
  }

  return reminders;
}
