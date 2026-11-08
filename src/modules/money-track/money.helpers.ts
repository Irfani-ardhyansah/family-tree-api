import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import {
  DEFAULT_MONEY_PERIOD_START_DAY,
  DEFAULT_MONEY_PERIOD_START_MODE,
  DEFAULT_MONEY_PERIOD_WEEKEND_ADJUST,
} from './money.constants';
import type {
  MoneyDebtDirection,
  MoneyDebtStatus,
  MoneyTransferKind,
} from './money.constants';
import type {
  MoneyPeriodDto,
  MoneyPeriodSettings,
  MoneyPocketRow,
  MoneyWorkspaceRow,
} from './money.types';

/**
 * Validate transfer kind against pocket ownership rules.
 * Pure helper — safe to unit test.
 */
export function assertTransferKindAllowed(
  kind: MoneyTransferKind,
  workspace: MoneyWorkspaceRow,
  from: MoneyPocketRow,
  to: MoneyPocketRow,
): void {
  if (from.id === to.id) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'fromPocketId dan toPocketId harus berbeda.',
    );
  }

  if (kind === 'interpersonal') {
    if (workspace.mode !== 'couple') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal hanya untuk mode couple.',
      );
    }
    if (from.owner_type !== 'person' || to.owner_type !== 'person') {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal harus antar pocket personal.',
      );
    }
    if (
      from.owner_person_id == null ||
      to.owner_person_id == null ||
      from.owner_person_id === to.owner_person_id
    ) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'Transfer interpersonal harus antar person berbeda.',
      );
    }
    return;
  }

  // interpocket: same person, or personal ↔ joint
  const samePerson =
    from.owner_person_id != null &&
    to.owner_person_id != null &&
    from.owner_person_id === to.owner_person_id;
  const involvesJoint = from.owner_type === 'joint' || to.owner_type === 'joint';

  if (!samePerson && !involvesJoint) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'Transfer interpocket hanya untuk pocket person yang sama, atau personal ↔ joint.',
    );
  }

  if (involvesJoint && workspace.mode !== 'couple') {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'Transfer ke/dari joint pocket hanya untuk mode couple.',
    );
  }
}

export function changePercent(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 100);
}

/** MoM % with 1 decimal. previous=0 & current>0 → 100 (FE treat as known; not null). */
export function changePercent1(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Inclusive calendar dates from `from` to `to` (YYYY-MM-DD). */
export function eachDateInRange(from: string, to: string): string[] {
  const out: string[] = [];
  const cur = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export const DEFAULT_MONEY_PERIOD_SETTINGS: MoneyPeriodSettings = {
  startMode: DEFAULT_MONEY_PERIOD_START_MODE,
  startDay: DEFAULT_MONEY_PERIOD_START_DAY,
  weekendAdjust: DEFAULT_MONEY_PERIOD_WEEKEND_ADJUST,
  holidays: [],
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDate(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
    date.getUTCDate(),
  )}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isNonWorkday(date: Date, holidays: Set<string>): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6 || holidays.has(formatUtcDate(date));
}

function shiftToWorkday(
  date: Date,
  direction: 'previous' | 'next',
  holidays: Set<string>,
): Date {
  const step = direction === 'previous' ? -1 : 1;
  let result = date;
  while (isNonWorkday(result, holidays)) {
    result = new Date(result.getTime() + step * 86_400_000);
  }
  return result;
}

/** Tanggal Jakarta (WIB) saat ini, aman dari pergeseran UTC. */
export function jakartaDateParts(date = new Date()): {
  yearMonth: string;
  date: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return {
    yearMonth: `${year}-${month}`,
    date: `${year}-${month}-${day}`,
  };
}

export function jakartaYearMonth(date = new Date()): string {
  return jakartaDateParts(date).yearMonth;
}

/**
 * Tanggal mulai periode untuk key `yearMonth` (bulan tempat periode dimulai).
 * Semua perhitungan pakai UTC supaya hasil tidak bergeser oleh timezone server.
 */
export function resolvePeriodStartDate(
  yearMonth: string,
  settings: MoneyPeriodSettings = DEFAULT_MONEY_PERIOD_SETTINGS,
): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = daysInMonth(year!, month!);
  const holidays = new Set(settings.holidays ?? []);

  if (settings.startMode === 'last_workday') {
    return formatUtcDate(
      shiftToWorkday(utcDate(year!, month!, lastDay), 'previous', holidays),
    );
  }

  const baseDay =
    settings.startMode === 'last_day'
      ? lastDay
      : Math.min(Math.max(1, settings.startDay), lastDay);

  let start = utcDate(year!, month!, baseDay);
  if (settings.weekendAdjust === 'previous_workday') {
    start = shiftToWorkday(start, 'previous', holidays);
  } else if (settings.weekendAdjust === 'next_workday') {
    start = shiftToWorkday(start, 'next', holidays);
  }
  return formatUtcDate(start);
}

export function nextYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, 1));
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
}

/**
 * Rentang inklusif satu periode. `to` = sehari sebelum periode berikutnya mulai,
 * jadi antar-periode selalu nyambung tanpa celah/overlap.
 */
export function periodDateRange(
  yearMonth: string,
  settings: MoneyPeriodSettings = DEFAULT_MONEY_PERIOD_SETTINGS,
): { from: string; to: string } {
  const from = resolvePeriodStartDate(yearMonth, settings);
  const nextStart = resolvePeriodStartDate(nextYearMonth(yearMonth), settings);
  const to = formatUtcDate(
    new Date(new Date(`${nextStart}T00:00:00.000Z`).getTime() - 86_400_000),
  );
  return { from, to };
}

/** Key periode yang sedang berjalan pada `date` (default: sekarang, WIB). */
export function currentPeriodYearMonth(
  date: Date,
  settings: MoneyPeriodSettings = DEFAULT_MONEY_PERIOD_SETTINGS,
): string {
  const { yearMonth, date: today } = jakartaDateParts(date);

  // Tanggal mulai bisa bergeser ke bulan sebelumnya/berikutnya (weekend adjust),
  // jadi cari periode yang rentangnya benar-benar memuat `today`.
  let candidate = yearMonth;
  for (let i = 0; i < 24; i += 1) {
    if (resolvePeriodStartDate(candidate, settings) <= today) break;
    candidate = previousYearMonth(candidate);
  }
  for (let i = 0; i < 24; i += 1) {
    const next = nextYearMonth(candidate);
    if (resolvePeriodStartDate(next, settings) > today) break;
    candidate = next;
  }
  return candidate;
}

/** Periode berjalan lengkap dengan label & rentang tanggal untuk FE. */
export function currentPeriodDto(
  date: Date,
  settings: MoneyPeriodSettings = DEFAULT_MONEY_PERIOD_SETTINGS,
): MoneyPeriodDto {
  const yearMonth = currentPeriodYearMonth(date, settings);
  const { from, to } = periodDateRange(yearMonth, settings);
  return { yearMonth, label: yearMonthLabel(yearMonth), from, to };
}

export function parseYearMonth(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus format YYYY-MM.`,
    );
  }
  const [y, m] = value.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} bukan periode valid.`);
  }
  return value;
}

export function previousYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  date.setUTCMonth(date.getUTCMonth() - 1);
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${yy}-${mm}`;
}

export function yearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, 1));
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** @deprecated pakai `periodDateRange` — dipertahankan untuk kompatibilitas. */
export function monthDateRange(
  yearMonth: string,
  settings: MoneyPeriodSettings = DEFAULT_MONEY_PERIOD_SETTINGS,
): { from: string; to: string } {
  return periodDateRange(yearMonth, settings);
}

/* ------------------------------------------------------------------------- *
 * Utang / piutang — efek ke kantong (derive, tidak menulis ke ledger).
 * Satu debt = satu angka: sign × (amount − paidTotal).
 * Pure helpers — safe to unit test.
 * ------------------------------------------------------------------------- */

/** Utang menambah saldo kantong (+1), piutang mengurangi (−1). */
export function debtEffectSign(direction: MoneyDebtDirection): 1 | -1 {
  return direction === 'utang' ? 1 : -1;
}

/**
 * Efek bertanda sebuah catatan utang/piutang terhadap saldo kantong.
 * `0` = lunas tanpa bunga; bisa negatif (utang yang dibayar melebihi pokok = ada bunga).
 */
export function debtNetEffect(
  direction: MoneyDebtDirection,
  amount: number,
  paidTotal: number,
): number {
  const net = debtEffectSign(direction) * (amount - paidTotal);
  // Normalisasi -0 → 0 supaya response JSON & pembanding FE bersih.
  return net === 0 ? 0 : net;
}

/** Sisa pokok — tidak pernah negatif. */
export function debtRemaining(amount: number, paidTotal: number): number {
  return Math.max(0, amount - paidTotal);
}

/** Kelebihan bayar yang dihitung sebagai bunga. */
export function debtInterestAmount(amount: number, paidTotal: number): number {
  return Math.max(0, paidTotal - amount);
}

/** Porsi satu pembayaran yang jatuh ke bunga (melewati sisa pokok sebelum bayar). */
export function debtPaymentInterestPortion(
  amount: number,
  paidTotalBefore: number,
  paymentAmount: number,
): number {
  return Math.max(0, paymentAmount - debtRemaining(amount, paidTotalBefore));
}

export function debtStatusFromPaid(
  amount: number,
  paidTotal: number,
): MoneyDebtStatus {
  if (paidTotal <= 0) return 'open';
  if (paidTotal >= amount) return 'paid';
  return 'partial';
}
