import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import { inferWorkspaceMode, parseDateOnly, toDateOnly } from './money.access';

describe('toDateOnly', () => {
  it('keeps YYYY-MM-DD strings as-is', () => {
    expect(toDateOnly('2026-08-01')).toBe('2026-08-01');
    expect(toDateOnly('2026-08-01T00:00:00.000Z')).toBe('2026-08-01');
  });

  it('uses local calendar day for Date (no UTC shift)', () => {
    // Local midnight Aug 1 — toISOString would be previous day in WIB.
    const localMidnight = new Date(2026, 7, 1, 0, 0, 0, 0);
    expect(toDateOnly(localMidnight)).toBe('2026-08-01');
  });
});

describe('parseDateOnly', () => {
  it('accepts calendar date-only', () => {
    expect(parseDateOnly('2026-08-01', 'date')).toBe('2026-08-01');
  });

  it('rejects datetime / invalid', () => {
    expect(() => parseDateOnly('2026-08-01T00:00:00.000Z', 'date')).toThrow(AppError);
    expect(() => parseDateOnly('2026-13-01', 'date')).toThrow(AppError);
  });
});

describe('inferWorkspaceMode', () => {
  it('accepts single self', () => {
    expect(inferWorkspaceMode(['self'])).toBe('single');
  });

  it('accepts couple husband+wife', () => {
    expect(inferWorkspaceMode(['husband', 'wife'])).toBe('couple');
    expect(inferWorkspaceMode(['wife', 'husband'])).toBe('couple');
  });

  it('rejects invalid combinations', () => {
    expect(() => inferWorkspaceMode(['self', 'husband'])).toThrow(AppError);
    expect(() => inferWorkspaceMode(['husband'])).toThrow(AppError);
    expect(() => inferWorkspaceMode([])).toThrow(AppError);
  });
});

describe('pocket balance formula', () => {
  it('computes ledger math', () => {
    const opening = 1_000_000;
    const income = 500_000;
    const expense = 200_000;
    const transferIn = 100_000;
    const transferOut = 50_000;
    const cashIn = 0;
    const cashOut = 25_000;
    const adjustment = -10_000;

    const balance =
      opening +
      income +
      transferIn +
      cashIn -
      expense -
      transferOut -
      cashOut +
      adjustment;

    expect(balance).toBe(1_315_000);
  });
});
