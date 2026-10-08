import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import {
  DEFAULT_MONEY_QUICK_AMOUNTS,
  MONEY_QUICK_AMOUNT_MAX,
} from '../money.constants';
import type {
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

export function defaultPreferences(): MoneyPreferencesDto {
  return {
    defaultTxType: 'expense',
    quickAmounts: [...DEFAULT_MONEY_QUICK_AMOUNTS],
    shared: emptyScopedDefaults(),
    persons: {},
  };
}

export function toPreferencesDto(
  row: MoneyPreferencesRow | undefined,
): MoneyPreferencesDto {
  if (!row) return defaultPreferences();
  return {
    defaultTxType: row.default_tx_type === 'income' ? 'income' : 'expense',
    quickAmounts: normalizeQuickAmounts(parseJsonField(row.quick_amounts)),
    shared: toScopedDefaults(parseJsonField(row.shared)),
    persons: toPersonsDefaults(parseJsonField(row.persons)),
  };
}
