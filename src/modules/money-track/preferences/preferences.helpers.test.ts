import { describe, expect, it } from 'vitest';
import { AppError } from '../../../shared/errors/AppError';
import { DEFAULT_MONEY_QUICK_AMOUNTS, MONEY_QUICK_AMOUNT_MAX } from '../money.constants';
import type { MoneyPreferencesRow } from '../money.types';
import {
  defaultPreferences,
  normalizeQuickAmounts,
  parseNullableId,
  toPreferencesDto,
} from './preferences.helpers';

describe('normalizeQuickAmounts', () => {
  it('falls back to defaults when input kosong / bukan array', () => {
    expect(normalizeQuickAmounts(undefined)).toEqual(DEFAULT_MONEY_QUICK_AMOUNTS);
    expect(normalizeQuickAmounts([])).toEqual(DEFAULT_MONEY_QUICK_AMOUNTS);
    expect(normalizeQuickAmounts('nope')).toEqual(DEFAULT_MONEY_QUICK_AMOUNTS);
  });

  it('dedupe, buang non-positif, dan batasi maksimum', () => {
    expect(normalizeQuickAmounts([10000, '10000', 0, -5, 20000.5, '50000'])).toEqual([
      10000,
      50000,
    ]);
    expect(
      normalizeQuickAmounts([1, 2, 3, 4, 5, 6, 7]).length,
    ).toBe(MONEY_QUICK_AMOUNT_MAX);
  });
});

describe('parseNullableId', () => {
  it('null/undefined/string kosong → null', () => {
    expect(parseNullableId(undefined, 'x')).toBeNull();
    expect(parseNullableId(null, 'x')).toBeNull();
    expect(parseNullableId('', 'x')).toBeNull();
  });

  it('menerima number & string digit', () => {
    expect(parseNullableId(12, 'x')).toBe(12);
    expect(parseNullableId('12', 'x')).toBe(12);
  });

  it('menolak nilai tidak valid dengan 422', () => {
    expect(() => parseNullableId('abc', 'x')).toThrow(AppError);
    expect(() => parseNullableId(0, 'x')).toThrow(AppError);
    expect(() => parseNullableId(-1, 'x')).toThrow(AppError);
  });
});

describe('toPreferencesDto', () => {
  it('default saat row undefined', () => {
    expect(toPreferencesDto(undefined)).toEqual(defaultPreferences());
  });

  it('mem-parse kolom JSON yang tersimpan sebagai string', () => {
    const row = {
      id: 1,
      workspace_id: 1,
      default_tx_type: 'income',
      quick_amounts: JSON.stringify([10000, 20000]),
      shared: JSON.stringify({
        expensePocketId: 5,
        incomePocketId: null,
        expenseCategoryId: 3,
        incomeCategoryId: null,
      }),
      persons: JSON.stringify({
        '7': {
          expensePocketId: 9,
          incomePocketId: null,
          expenseCategoryId: null,
          incomeCategoryId: null,
        },
      }),
      created_at: new Date(),
      updated_at: new Date(),
    } satisfies MoneyPreferencesRow;

    expect(toPreferencesDto(row)).toEqual({
      defaultTxType: 'income',
      quickAmounts: [10000, 20000],
      shared: {
        expensePocketId: 5,
        incomePocketId: null,
        expenseCategoryId: 3,
        incomeCategoryId: null,
      },
      persons: {
        '7': {
          expensePocketId: 9,
          incomePocketId: null,
          expenseCategoryId: null,
          incomeCategoryId: null,
        },
      },
    });
  });

  it('toleran kalau kolom JSON sudah berupa object', () => {
    const row = {
      id: 1,
      workspace_id: 1,
      default_tx_type: 'expense',
      quick_amounts: [50000],
      shared: { expensePocketId: 2 },
      persons: {},
      created_at: new Date(),
      updated_at: new Date(),
    } as unknown as MoneyPreferencesRow;

    const dto = toPreferencesDto(row);
    expect(dto.defaultTxType).toBe('expense');
    expect(dto.quickAmounts).toEqual([50000]);
    expect(dto.shared.expensePocketId).toBe(2);
    expect(dto.shared.incomePocketId).toBeNull();
  });
});
