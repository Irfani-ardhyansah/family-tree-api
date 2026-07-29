import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import {
  assertTransferKindAllowed,
  changePercent,
  previousYearMonth,
  yearMonthLabel,
} from './money.helpers';
import type { MoneyPocketRow, MoneyWorkspaceRow } from './money.types';

function pocket(
  partial: Partial<MoneyPocketRow> & Pick<MoneyPocketRow, 'id' | 'owner_type' | 'owner_person_id'>,
): MoneyPocketRow {
  return {
    workspace_id: 1,
    account_id: 1,
    category: 'transaksi',
    name: 'P',
    goal_amount: null,
    goal_date: null,
    is_system: false,
    archived_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  };
}

const coupleWs: MoneyWorkspaceRow = {
  id: 1,
  family_id: 1,
  mode: 'couple',
  couple_linked_at: new Date(),
  created_at: new Date(),
  updated_at: new Date(),
};

const singleWs: MoneyWorkspaceRow = { ...coupleWs, mode: 'single', couple_linked_at: null };

describe('assertTransferKindAllowed', () => {
  it('allows interpersonal between different persons in couple', () => {
    expect(() =>
      assertTransferKindAllowed(
        'interpersonal',
        coupleWs,
        pocket({ id: 1, owner_type: 'person', owner_person_id: 10 }),
        pocket({ id: 2, owner_type: 'person', owner_person_id: 20 }),
      ),
    ).not.toThrow();
  });

  it('rejects interpersonal in single mode', () => {
    expect(() =>
      assertTransferKindAllowed(
        'interpersonal',
        singleWs,
        pocket({ id: 1, owner_type: 'person', owner_person_id: 10 }),
        pocket({ id: 2, owner_type: 'person', owner_person_id: 20 }),
      ),
    ).toThrow(AppError);
  });

  it('allows interpocket same person', () => {
    expect(() =>
      assertTransferKindAllowed(
        'interpocket',
        coupleWs,
        pocket({ id: 1, owner_type: 'person', owner_person_id: 10 }),
        pocket({ id: 2, owner_type: 'person', owner_person_id: 10 }),
      ),
    ).not.toThrow();
  });

  it('allows interpocket personal to joint', () => {
    expect(() =>
      assertTransferKindAllowed(
        'interpocket',
        coupleWs,
        pocket({ id: 1, owner_type: 'person', owner_person_id: 10 }),
        pocket({ id: 2, owner_type: 'joint', owner_person_id: null }),
      ),
    ).not.toThrow();
  });

  it('rejects interpocket across different persons without joint', () => {
    expect(() =>
      assertTransferKindAllowed(
        'interpocket',
        coupleWs,
        pocket({ id: 1, owner_type: 'person', owner_person_id: 10 }),
        pocket({ id: 2, owner_type: 'person', owner_person_id: 20 }),
      ),
    ).toThrow(AppError);
  });
});

describe('changePercent / yearMonth helpers', () => {
  it('computes change percent', () => {
    expect(changePercent(110, 100)).toBe(10);
    expect(changePercent(0, 0)).toBe(0);
    expect(changePercent(50, 0)).toBe(100);
  });

  it('previousYearMonth rolls over', () => {
    expect(previousYearMonth('2026-01')).toBe('2025-12');
    expect(previousYearMonth('2026-07')).toBe('2026-06');
  });

  it('yearMonthLabel is Indonesian', () => {
    expect(yearMonthLabel('2026-07')).toMatch(/Juli/);
    expect(yearMonthLabel('2026-07')).toMatch(/2026/);
  });
});
