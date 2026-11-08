import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  DEFAULT_MONEY_PERIOD_START_DAY,
  DEFAULT_MONEY_PERIOD_START_MODE,
  DEFAULT_MONEY_PERIOD_WEEKEND_ADJUST,
  DEFAULT_MONEY_QUICK_AMOUNTS,
  MONEY_PERIOD_HOLIDAY_MAX,
  MONEY_PERIOD_START_MODES,
  MONEY_PERIOD_WEEKEND_ADJUSTS,
  MONEY_QUICK_AMOUNT_MAX,
} from '../money.constants';
import {
  currentPeriodDto,
  DEFAULT_MONEY_PERIOD_SETTINGS,
} from '../money.helpers';
import type {
  MoneyPeriodSettings,
  MoneyPreferencesDto,
  MoneyPreferencesRow,
  MoneyScopedDefaultsDto,
} from '../money.types';

/** mysql2 bisa balikin kolom JSON sebagai string atau object — normalkan. */
export function parseJsonField(value: unknown): unknown {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export function emptyScopedDefaults(): MoneyScopedDefaultsDto {
  return {
    expensePocketId: null,
    incomePocketId: null,
    expenseCategoryId: null,
    incomeCategoryId: null,
  };
}

/** Terima array angka/string → integer positif unik, maks N, fallback default. */
export function normalizeQuickAmounts(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : DEFAULT_MONEY_QUICK_AMOUNTS;
  const seen = new Set<number>();
  const list: number[] = [];
  for (const item of raw) {
    const n =
      typeof item === 'number'
        ? item
        : typeof item === 'string' && item.trim() !== ''
          ? Number(item)
          : NaN;
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    list.push(n);
    if (list.length >= MONEY_QUICK_AMOUNT_MAX) break;
  }
  return list.length > 0 ? list : [...DEFAULT_MONEY_QUICK_AMOUNTS];
}

/**
 * ID opsional untuk disimpan: undefined/null/'' → null.
 * Nilai tidak valid → 422 (dipakai saat parsing body request).
 */
export function parseNullableId(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const n = Number(value);
    if (n > 0) return n;
  }
  throw new AppError(
    422,
    ErrorCodes.VALIDATION_ERROR,
    `${field} harus id positif atau null.`,
  );
}

/** Baca satu blok default dari JSON tersimpan (toleran bentuk apa pun). */
export function toScopedDefaults(value: unknown): MoneyScopedDefaultsDto {
  const row = (value ?? {}) as Record<string, unknown>;
  const id = (raw: unknown): number | null => {
    if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) return raw;
    if (typeof raw === 'string' && /^\d+$/.test(raw)) return Number(raw);
    return null;
  };
  return {
    expensePocketId: id(row.expensePocketId),
    incomePocketId: id(row.incomePocketId),
    expenseCategoryId: id(row.expenseCategoryId),
    incomeCategoryId: id(row.incomeCategoryId),
  };
}

export function toPersonsDefaults(
  value: unknown,
): Record<string, MoneyScopedDefaultsDto> {
  const result: Record<string, MoneyScopedDefaultsDto> = {};
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return result;
  }
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!key) continue;
    result[key] = toScopedDefaults(raw);
  }
  return result;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Normalisasi daftar libur: tanggal valid, unik, urut, maks N. */
export function normalizePeriodHolidays(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? parseJsonField(value)
      : [];
  if (!Array.isArray(raw)) return [];

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string' || !isValidDateOnly(item.trim())) continue;
    const date = item.trim();
    if (seen.has(date)) continue;
    seen.add(date);
    result.push(date);
    if (result.length >= MONEY_PERIOD_HOLIDAY_MAX) break;
  }
  return result.sort();
}

export function toPeriodSettings(
  row: MoneyPreferencesRow | undefined,
): MoneyPeriodSettings {
  if (!row) return { ...DEFAULT_MONEY_PERIOD_SETTINGS };

  const startMode = (MONEY_PERIOD_START_MODES as readonly string[]).includes(
    row.period_start_mode,
  )
    ? row.period_start_mode
    : DEFAULT_MONEY_PERIOD_START_MODE;
  const startDay = Number(row.period_start_day);
  const weekendAdjust = (
    MONEY_PERIOD_WEEKEND_ADJUSTS as readonly string[]
  ).includes(row.period_weekend_adjust)
    ? row.period_weekend_adjust
    : DEFAULT_MONEY_PERIOD_WEEKEND_ADJUST;

  return {
    startMode,
    startDay:
      Number.isInteger(startDay) && startDay >= 1 && startDay <= 31
        ? startDay
        : DEFAULT_MONEY_PERIOD_START_DAY,
    weekendAdjust,
    holidays: normalizePeriodHolidays(row.period_holidays),
  };
}

function parsePeriodStartDay(value: unknown): number {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_MONEY_PERIOD_START_DAY;
  }
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;
  if (!Number.isInteger(n) || n < 1 || n > 31) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'period.startDay harus bilangan bulat 1–31.',
    );
  }
  return n;
}

/** Body `PUT /money/preferences` → setting periode (default kalau tidak dikirim). */
export function parsePeriodSettings(
  raw: Record<string, unknown>,
): MoneyPeriodSettings {
  const rawPeriod = raw.period;
  if (
    rawPeriod !== undefined &&
    rawPeriod !== null &&
    (typeof rawPeriod !== 'object' || Array.isArray(rawPeriod))
  ) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'period harus objek.',
    );
  }
  const period = (rawPeriod ?? {}) as Record<string, unknown>;

  const startMode =
    period.startMode === undefined
      ? DEFAULT_MONEY_PERIOD_START_MODE
      : parsePeriodEnum(
          period.startMode,
          'period.startMode',
          MONEY_PERIOD_START_MODES,
        );
  const weekendAdjust =
    period.weekendAdjust === undefined
      ? DEFAULT_MONEY_PERIOD_WEEKEND_ADJUST
      : parsePeriodEnum(
          period.weekendAdjust,
          'period.weekendAdjust',
          MONEY_PERIOD_WEEKEND_ADJUSTS,
        );

  return {
    startMode,
    startDay: parsePeriodStartDay(period.startDay),
    weekendAdjust,
    holidays: parsePeriodHolidays(period.holidays),
  };
}

function parsePeriodHolidays(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  if (!Array.isArray(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'period.holidays harus array tanggal YYYY-MM-DD.',
    );
  }
  const invalid = value.find(
    (item) => typeof item !== 'string' || !isValidDateOnly(item.trim()),
  );
  if (invalid !== undefined) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      'period.holidays harus array tanggal YYYY-MM-DD.',
    );
  }
  if (value.length > MONEY_PERIOD_HOLIDAY_MAX) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `period.holidays maksimal ${MONEY_PERIOD_HOLIDAY_MAX} tanggal.`,
    );
  }
  return normalizePeriodHolidays(value);
}

function parsePeriodEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new AppError(
      422,
      ErrorCodes.VALIDATION_ERROR,
      `${field} harus salah satu dari: ${allowed.join(', ')}.`,
    );
  }
  return value as T;
}

export function defaultPreferences(now = new Date()): MoneyPreferencesDto {
  const period = DEFAULT_MONEY_PERIOD_SETTINGS;
  return {
    defaultTxType: 'expense',
    quickAmounts: [...DEFAULT_MONEY_QUICK_AMOUNTS],
    shared: emptyScopedDefaults(),
    persons: {},
    period: {
      ...period,
      holidays: [...period.holidays],
      current: currentPeriodDto(now, period),
    },
  };
}

export function toPreferencesDto(
  row: MoneyPreferencesRow | undefined,
  now = new Date(),
): MoneyPreferencesDto {
  if (!row) return defaultPreferences(now);
  const period = toPeriodSettings(row);
  return {
    defaultTxType: row.default_tx_type === 'income' ? 'income' : 'expense',
    quickAmounts: normalizeQuickAmounts(parseJsonField(row.quick_amounts)),
    shared: toScopedDefaults(parseJsonField(row.shared)),
    persons: toPersonsDefaults(parseJsonField(row.persons)),
    period: {
      ...period,
      holidays: [...period.holidays],
      current: currentPeriodDto(now, period),
    },
  };
}
