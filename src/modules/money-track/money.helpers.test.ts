import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import {
  assertTransferKindAllowed,
  changePercent,
  changePercent1,
  debtEffectSign,
  debtInterestAmount,
  debtNetEffect,
  debtPaymentInterestPortion,
  debtRemaining,
  debtStatusFromPaid,
  eachDateInRange,
  previousYearMonth,
  round1,
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

  it('changePercent1 keeps one decimal', () => {
    expect(changePercent1(110, 100)).toBe(10);
    expect(changePercent1(10320000, 8050000)).toBe(28.2);
    expect(changePercent1(50, 0)).toBe(100);
  });

  it('eachDateInRange fills calendar days', () => {
    expect(eachDateInRange('2026-08-30', '2026-08-31')).toEqual([
      '2026-08-30',
      '2026-08-31',
    ]);
    expect(eachDateInRange('2026-02-01', '2026-02-01')).toEqual(['2026-02-01']);
    expect(round1(22.55)).toBe(22.6);
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

describe('utang/piutang — efek kantong & bunga', () => {
  it('utang menambah saldo, piutang mengurangi', () => {
    expect(debtEffectSign('utang')).toBe(1);
    expect(debtEffectSign('piutang')).toBe(-1);
  });

  it('netEffect utang: open → partial → lunas → minus kalau ada bunga', () => {
    expect(debtNetEffect('utang', 5_000_000, 0)).toBe(5_000_000);
    expect(debtNetEffect('utang', 5_000_000, 2_000_000)).toBe(3_000_000);
    expect(debtNetEffect('utang', 5_000_000, 5_000_000)).toBe(0);
    expect(debtNetEffect('utang', 5_000_000, 5_500_000)).toBe(-500_000);
  });

  it('netEffect piutang: open → partial → lunas → plus kalau ada bunga', () => {
    expect(debtNetEffect('piutang', 2_000_000, 0)).toBe(-2_000_000);
    expect(debtNetEffect('piutang', 2_000_000, 1_000_000)).toBe(-1_000_000);
    expect(debtNetEffect('piutang', 2_000_000, 2_000_000)).toBe(0);
    expect(debtNetEffect('piutang', 2_000_000, 2_300_000)).toBe(300_000);
  });

  it('remaining tidak pernah negatif, interest = kelebihan bayar', () => {
    expect(debtRemaining(1_000_000, 400_000)).toBe(600_000);
    expect(debtRemaining(1_000_000, 1_200_000)).toBe(0);
    expect(debtInterestAmount(1_000_000, 1_200_000)).toBe(200_000);
    expect(debtInterestAmount(1_000_000, 1_000_000)).toBe(0);
    expect(debtInterestAmount(1_000_000, 300_000)).toBe(0);
  });

  it('porsi bunga per pembayaran dihitung running', () => {
    // pokok 1.000.000 → bayar 400.000 (bunga 0) → bayar 800.000 (bunga 200.000)
    expect(debtPaymentInterestPortion(1_000_000, 0, 400_000)).toBe(0);
    expect(debtPaymentInterestPortion(1_000_000, 400_000, 800_000)).toBe(200_000);
    // utang 1.000.000 langsung dibayar 1.200.000 → bunga 200.000
    expect(debtPaymentInterestPortion(1_000_000, 0, 1_200_000)).toBe(200_000);
  });

  it('status dari paidTotal', () => {
    expect(debtStatusFromPaid(1_000_000, 0)).toBe('open');
    expect(debtStatusFromPaid(1_000_000, 400_000)).toBe('partial');
    expect(debtStatusFromPaid(1_000_000, 1_000_000)).toBe('paid');
    expect(debtStatusFromPaid(1_000_000, 1_500_000)).toBe('paid');
  });
});
