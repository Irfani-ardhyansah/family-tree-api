import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { moneyAccessRepository } from '../money-access.repository';
import {
  asNumber,
  parseOptionalDateOnly,
  parseOptionalEnum,
  parseOptionalString,
  parsePage,
  parsePositiveInt,
  resolveMoneyContext,
  toDateOnly,
} from '../money.access';
import { loadEnrichmentMaps, pocketLabel } from '../money.enrichment';
import { debtInterestAmount, debtRemaining } from '../money.helpers';
import type { MoneyDebtDirection, MoneyDebtStatus } from '../money.constants';
import type {
  MoneyActivityItemDto,
  MoneyActivityKind,
  MoneyPaginated,
} from '../money.types';

const ACTIVITY_KINDS = [
  'income',
  'expense',
  'transfer',
  'cash_withdrawal',
  'debt',
  'all',
] as const;

type RawActivityRow = {
  feed_id: string;
  kind: MoneyActivityKind;
  title: string | null;
  category_id: number | null;
  pocket_id: number | null;
  to_pocket_id: number | null;
  amount: number | string;
  date: string;
  sort_id: number;
  /** Diisi hanya oleh branch `debt`. */
  debt_direction: MoneyDebtDirection | null;
  debt_status: MoneyDebtStatus | null;
  debt_amount: number | string | null;
  debt_paid_total: number | string | null;
  debt_id: number | null;
};

function parseBoolFlag(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus true atau false.`);
}

export class ActivityService {
  async list(
    authPersonId: number,
    familyId: number,
    query: Record<string, unknown>,
  ): Promise<MoneyPaginated<MoneyActivityItemDto>> {
    const ctx = await resolveMoneyContext(authPersonId, familyId);
    const { page, pageSize } = parsePage(query);
    const from = parseOptionalDateOnly(query.from, 'from') ?? undefined;
    const to = parseOptionalDateOnly(query.to, 'to') ?? undefined;
    const personId =
      query.personId === undefined
        ? undefined
        : parsePositiveInt(query.personId, 'personId');
    const pocketId =
      query.pocketId === undefined
        ? undefined
        : parsePositiveInt(query.pocketId, 'pocketId');
    const kind =
      query.kind === undefined
        ? 'all'
        : parseOptionalEnum(query.kind, 'kind', ACTIVITY_KINDS) ?? 'all';
    const uncategorized = parseBoolFlag(query.uncategorized, 'uncategorized');
    const categoryId =
      uncategorized
        ? undefined
        : query.categoryId === undefined
          ? undefined
          : parsePositiveInt(query.categoryId, 'categoryId');
    const q = parseOptionalString(query.q, 'q', 120) ?? undefined;
    // Utang/piutang ikut tampil di list transaksi; `includeDebts=false` = opt-out.
    const includeDebtsFlag = parseBoolFlag(query.includeDebts, 'includeDebts') ?? true;

    if (personId != null) {
      const person = await moneyAccessRepository.findPersonById(
        ctx.workspace.id,
        personId,
      );
      if (!person) {
        throw new AppError(404, ErrorCodes.MONEY_PERSON_NOT_FOUND, 'Person tidak ditemukan.');
      }
    }

    const includeTxn =
      kind === 'all' || kind === 'income' || kind === 'expense';
    const includeTransfer = kind === 'all' || kind === 'transfer';
    const includeCash = kind === 'all' || kind === 'cash_withdrawal';
    // `includeDebts=false` menonaktifkan branch debt sepenuhnya (jaring pengaman FE).
    const includeDebt =
      includeDebtsFlag && (kind === 'debt' || kind === 'all');

    // category/uncategorized only apply to txn kinds
    const txnOnlyFilters =
      (categoryId != null || uncategorized === true) &&
      !includeTxn &&
      (includeTransfer || includeCash || includeDebt);

    if (txnOnlyFilters) {
      return { items: [], page, pageSize, total: 0 };
    }

    const parts: string[] = [];
    const bindings: unknown[] = [];

    if (includeTxn) {
      let sql = `
        SELECT CONCAT('txn:', t.id) AS feed_id,
               t.type AS kind,
               t.note AS title,
               t.category_id AS category_id,
               t.pocket_id AS pocket_id,
               NULL AS to_pocket_id,
               t.amount AS amount,
               t.date AS date,
               t.id AS sort_id,
               NULL AS debt_direction,
               NULL AS debt_status,
               NULL AS debt_amount,
               NULL AS debt_paid_total,
               NULL AS debt_id
        FROM ${Tables.MONEY_TRANSACTIONS} t
        INNER JOIN ${Tables.MONEY_POCKETS} p ON p.id = t.pocket_id
        WHERE t.workspace_id = ?
          AND t.type IN ('income', 'expense')
      `;
      bindings.push(ctx.workspace.id);
      if (kind === 'income' || kind === 'expense') {
        sql += ` AND t.type = ?`;
        bindings.push(kind);
      }
      if (from) {
        sql += ` AND t.date >= ?`;
        bindings.push(from);
      }
      if (to) {
        sql += ` AND t.date <= ?`;
        bindings.push(to);
      }
      if (pocketId != null) {
        sql += ` AND t.pocket_id = ?`;
        bindings.push(pocketId);
      }
      if (personId != null) {
        sql += ` AND p.owner_person_id = ?`;
        bindings.push(personId);
      }
      if (uncategorized) {
        sql += ` AND t.category_id IS NULL`;
      } else if (categoryId != null) {
        sql += ` AND t.category_id = ?`;
        bindings.push(categoryId);
      }
      if (q) {
        sql += ` AND t.note LIKE ?`;
        bindings.push(`%${q}%`);
      }
      parts.push(`(${sql})`);
    }

    if (includeTransfer && uncategorized !== true && categoryId == null) {
      let sql = `
        SELECT CONCAT('xfer:', x.id) AS feed_id,
               'transfer' AS kind,
               x.note AS title,
               NULL AS category_id,
               x.from_pocket_id AS pocket_id,
               x.to_pocket_id AS to_pocket_id,
               x.amount AS amount,
               x.date AS date,
               x.id AS sort_id,
               NULL AS debt_direction,
               NULL AS debt_status,
               NULL AS debt_amount,
               NULL AS debt_paid_total,
               NULL AS debt_id
        FROM ${Tables.MONEY_TRANSFERS} x
        INNER JOIN ${Tables.MONEY_POCKETS} pf ON pf.id = x.from_pocket_id
        INNER JOIN ${Tables.MONEY_POCKETS} pt ON pt.id = x.to_pocket_id
        WHERE x.workspace_id = ?
      `;
      bindings.push(ctx.workspace.id);
      if (from) {
        sql += ` AND x.date >= ?`;
        bindings.push(from);
      }
      if (to) {
        sql += ` AND x.date <= ?`;
        bindings.push(to);
      }
      if (pocketId != null) {
        sql += ` AND (x.from_pocket_id = ? OR x.to_pocket_id = ?)`;
        bindings.push(pocketId, pocketId);
      }
      if (personId != null) {
        sql += ` AND (pf.owner_person_id = ? OR pt.owner_person_id = ?)`;
        bindings.push(personId, personId);
      }
      if (q) {
        sql += ` AND x.note LIKE ?`;
        bindings.push(`%${q}%`);
      }
      parts.push(`(${sql})`);
    }

    if (includeCash && uncategorized !== true && categoryId == null) {
      let sql = `
        SELECT CONCAT('cash:', c.id) AS feed_id,
               'cash_withdrawal' AS kind,
               c.note AS title,
               NULL AS category_id,
               c.from_pocket_id AS pocket_id,
               c.to_cash_pocket_id AS to_pocket_id,
               c.amount AS amount,
               c.date AS date,
               c.id AS sort_id,
               NULL AS debt_direction,
               NULL AS debt_status,
               NULL AS debt_amount,
               NULL AS debt_paid_total,
               NULL AS debt_id
        FROM ${Tables.MONEY_CASH_WITHDRAWALS} c
        INNER JOIN ${Tables.MONEY_POCKETS} p ON p.id = c.from_pocket_id
        WHERE c.workspace_id = ?
      `;
      bindings.push(ctx.workspace.id);
      if (from) {
        sql += ` AND c.date >= ?`;
        bindings.push(from);
      }
      if (to) {
        sql += ` AND c.date <= ?`;
        bindings.push(to);
      }
      if (pocketId != null) {
        sql += ` AND (c.from_pocket_id = ? OR c.to_cash_pocket_id = ?)`;
        bindings.push(pocketId, pocketId);
      }
      if (personId != null) {
        sql += ` AND p.owner_person_id = ?`;
        bindings.push(personId);
      }
      if (q) {
        sql += ` AND c.note LIKE ?`;
        bindings.push(`%${q}%`);
      }
      parts.push(`(${sql})`);
    }

    if (includeDebt && uncategorized !== true && categoryId == null) {
      let sql = `
        SELECT CONCAT('debt:', d.id) AS feed_id,
               'debt' AS kind,
               d.counterparty_name AS title,
               NULL AS category_id,
               d.pocket_id AS pocket_id,
               NULL AS to_pocket_id,
               (CASE d.direction
                  WHEN 'utang' THEN d.amount - COALESCE(p.paid, 0)
                  ELSE COALESCE(p.paid, 0) - d.amount
                END) AS amount,
               d.date AS date,
               d.id AS sort_id,
               d.direction AS debt_direction,
               d.status AS debt_status,
               d.amount AS debt_amount,
               COALESCE(p.paid, 0) AS debt_paid_total,
               d.id AS debt_id
        FROM ${Tables.MONEY_DEBTS} d
        INNER JOIN ${Tables.MONEY_POCKETS} dp ON dp.id = d.pocket_id
        LEFT JOIN (
          SELECT debt_id, SUM(amount) AS paid
          FROM ${Tables.MONEY_DEBT_PAYMENTS}
          GROUP BY debt_id
        ) p ON p.debt_id = d.id
        WHERE d.workspace_id = ?
          AND d.pocket_id IS NOT NULL
      `;
      bindings.push(ctx.workspace.id);
      if (from) {
        sql += ` AND d.date >= ?`;
        bindings.push(from);
      }
      if (to) {
        sql += ` AND d.date <= ?`;
        bindings.push(to);
      }
      if (pocketId != null) {
        sql += ` AND d.pocket_id = ?`;
        bindings.push(pocketId);
      }
      if (personId != null) {
        sql += ` AND dp.owner_person_id = ?`;
        bindings.push(personId);
      }
      if (q) {
        sql += ` AND d.counterparty_name LIKE ?`;
        bindings.push(`%${q}%`);
      }
      parts.push(`(${sql})`);
    }

    if (parts.length === 0) {
      return { items: [], page, pageSize, total: 0 };
    }

    const unionSql = parts.join(' UNION ALL ');
    const countRow = await db.raw(
      `SELECT COUNT(*) AS total FROM (${unionSql}) AS feed`,
      bindings,
    );
    const total = Number(countRow[0]?.[0]?.total ?? countRow[0]?.total ?? 0);

    const offset = (page - 1) * pageSize;
    const listBindings = [...bindings, pageSize, offset];
    const listResult = await db.raw(
      `SELECT * FROM (${unionSql}) AS feed
       ORDER BY date DESC, sort_id DESC
       LIMIT ? OFFSET ?`,
      listBindings,
    );
    const rows = (listResult[0] ?? listResult) as RawActivityRow[];

    const pocketIds = rows.flatMap((r) =>
      [r.pocket_id, r.to_pocket_id].filter((id): id is number => id != null),
    );
    const categoryIds = rows
      .map((r) => r.category_id)
      .filter((id): id is number => id != null);
    const maps = await loadEnrichmentMaps(ctx.workspace.id, pocketIds, categoryIds);

    const items: MoneyActivityItemDto[] = rows.map((row) => {
      const pocket = row.pocket_id != null ? maps.pockets.get(row.pocket_id) : undefined;
      const personIdVal = pocket?.owner_person_id ?? null;
      const person =
        personIdVal != null ? maps.persons.get(personIdVal) : undefined;
      const category =
        row.category_id != null ? maps.categories.get(row.category_id) : undefined;
      const kindVal = row.kind;
      const isDebt = kindVal === 'debt';
      const rawAmount = asNumber(row.amount) ?? 0;
      // Baris debt = efek net (bisa 0 / negatif); kind lain selalu positif.
      const amount = isDebt ? Math.abs(rawAmount) : rawAmount;
      const principalAmount = isDebt ? (asNumber(row.debt_amount) ?? 0) : 0;
      const debtPaidTotal = isDebt ? (asNumber(row.debt_paid_total) ?? 0) : 0;
      const debtDirectionLabel =
        row.debt_direction === 'piutang' ? 'Piutang' : 'Utang';

      let signed: MoneyActivityItemDto['signed'];
      if (isDebt) {
        signed = rawAmount > 0 ? 'pos' : rawAmount < 0 ? 'neg' : 'neutral';
      } else {
        signed =
          kindVal === 'income' ? 'pos' : kindVal === 'expense' ? 'neg' : 'neutral';
      }

      let link = '/money/transactions';
      if (kindVal === 'transfer') link = `/money/transfers/${row.sort_id}`;
      else if (kindVal === 'cash_withdrawal') link = `/money/cash-withdrawals/${row.sort_id}`;
      else if (isDebt) link = `/money/debts/${row.debt_id ?? row.sort_id}`;
      else link = `/money/transactions/${row.sort_id}`;

      const fromLabel = pocketLabel(row.pocket_id, maps);
      const toId = row.to_pocket_id;
      const toLabel =
        kindVal === 'transfer' || kindVal === 'cash_withdrawal'
          ? pocketLabel(toId, maps) || (kindVal === 'cash_withdrawal' ? 'Cash' : null)
          : null;

      return {
        id: row.feed_id,
        kind: kindVal,
        title:
          row.title ||
          (kindVal === 'income'
            ? 'Pemasukan'
            : kindVal === 'expense'
              ? 'Pengeluaran'
              : kindVal === 'transfer'
                ? 'Transfer'
                : kindVal === 'cash_withdrawal'
                  ? 'Tarik tunai'
                  : debtDirectionLabel),
        categoryName:
          category?.name ??
          (kindVal === 'transfer'
            ? 'Transfer'
            : kindVal === 'cash_withdrawal'
              ? 'Tarik tunai'
              : isDebt
                ? debtDirectionLabel
                : null),
        categoryId: row.category_id,
        personId: personIdVal,
        personName: person?.name ?? null,
        pocketLabel: fromLabel,
        pocketId: row.pocket_id,
        fromPocketLabel: fromLabel || null,
        toPocketId: toId,
        toPocketLabel: toLabel,
        amount,
        date: toDateOnly(row.date),
        signed,
        link,
        direction: isDebt ? row.debt_direction : null,
        status: isDebt ? row.debt_status : null,
        principalAmount: isDebt ? principalAmount : null,
        paidTotal: isDebt ? debtPaidTotal : null,
        remaining: isDebt ? debtRemaining(principalAmount, debtPaidTotal) : null,
        netAmount: isDebt ? rawAmount : null,
        interestAmount: isDebt
          ? debtInterestAmount(principalAmount, debtPaidTotal)
          : null,
      };
    });

    return { items, page, pageSize, total };
  }
}

export const activityService = new ActivityService();
