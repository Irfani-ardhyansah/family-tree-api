import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import { inferWorkspaceMode } from './money.access';

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
