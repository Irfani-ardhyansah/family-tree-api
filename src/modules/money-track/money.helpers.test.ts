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
  currentPeriodYearMonth,
  periodDateRange,
  previousYearMonth,
  resolvePeriodStartDate,
  round1,
  yearMonthLabel,
} from './money.helpers';
import type {
  MoneyPeriodSettings,
  MoneyPocketRow,
  MoneyWorkspaceRow,
} from './money.types';

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

describe('periode bulanan (jadwal reset/gajian)', () => {
  const settings = (
    partial: Partial<MoneyPeriodSettings>,
  ): MoneyPeriodSettings => ({
    startMode: 'fixed_day',
    startDay: 1,
    weekendAdjust: 'none',
    holidays: [],
    ...partial,
  });

  it('default tetap bulan kalender (tanggal 1)', () => {
    expect(periodDateRange('2026-10', settings({}))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });

  it('tanggal tetap: 25 Okt – 24 Nov', () => {
    expect(
      periodDateRange('2026-10', settings({ startDay: 25 })),
    ).toEqual({ from: '2026-10-25', to: '2026-11-24' });
  });

  it('hari terakhir bulan', () => {
    expect(
      periodDateRange('2026-10', settings({ startMode: 'last_day' })),
    ).toEqual({ from: '2026-10-31', to: '2026-11-29' });
  });

  it('hari kerja terakhir bulan (30/31 weekend → mundur Jumat)', () => {
    // 31 Okt 2026 Sabtu, 30 Nov 2026 Senin.
    expect(
      periodDateRange('2026-10', settings({ startMode: 'last_workday' })),
    ).toEqual({ from: '2026-10-30', to: '2026-11-29' });
    // 31 Mei 2026 Minggu → Jumat 29 Mei.
    expect(
      resolvePeriodStartDate(
        '2026-05',
        settings({ startMode: 'last_workday' }),
      ),
    ).toBe('2026-05-29');
  });

  it('libur manual ikut dilewati (30/31 libur nasional)', () => {
    // 31 Des 2026 Kamis, tapi kalau libur → Rabu 30 Des.
    expect(
      resolvePeriodStartDate(
        '2026-12',
        settings({
          startMode: 'last_workday',
          holidays: ['2026-12-31'],
        }),
      ),
    ).toBe('2026-12-30');
    expect(
      resolvePeriodStartDate(
        '2026-12',
        settings({
          startDay: 31,
          weekendAdjust: 'previous_workday',
          holidays: ['2026-12-31'],
        }),
      ),
    ).toBe('2026-12-30');
  });

  it('tanggal 31 + geser ke hari kerja sebelumnya', () => {
    expect(
      periodDateRange(
        '2026-10',
        settings({ startDay: 31, weekendAdjust: 'previous_workday' }),
      ),
    ).toEqual({ from: '2026-10-30', to: '2026-11-29' });
    // Februari pendek: 28 Feb 2026 Sabtu → Jumat 27 Feb.
    expect(
      resolvePeriodStartDate(
        '2026-02',
        settings({ startDay: 31, weekendAdjust: 'previous_workday' }),
      ),
    ).toBe('2026-02-27');
  });

  it('tanggal 1 + geser ke hari kerja berikutnya', () => {
    expect(
      periodDateRange(
        '2026-11',
        settings({ startDay: 1, weekendAdjust: 'next_workday' }),
      ),
    ).toEqual({ from: '2026-11-02', to: '2026-11-30' });
  });

  it('periode berjalan mengikuti jam Jakarta', () => {
    const now = new Date('2026-11-08T05:00:00.000Z'); // 12:00 WIB
    expect(currentPeriodYearMonth(now, settings({}))).toBe('2026-11');
    expect(currentPeriodYearMonth(now, settings({ startDay: 25 }))).toBe(
      '2026-10',
    );
    expect(
      currentPeriodYearMonth(now, settings({ startMode: 'last_workday' })),
    ).toBe('2026-10');
    expect(
      currentPeriodYearMonth(
        new Date('2026-11-25T05:00:00.000Z'),
        settings({ startDay: 25 }),
      ),
    ).toBe('2026-11');
    expect(
      currentPeriodYearMonth(
        new Date('2026-11-30T05:00:00.000Z'),
        settings({ startMode: 'last_workday' }),
      ),
    ).toBe('2026-11');
  });

  it('tetap benar saat tanggal mulai bergeser lintas bulan', () => {
    // 31 Jan 2026 Sabtu + next_workday → mulai 2 Feb. Tanggal 1 Feb masih
    // masuk periode Desember (31 Des 2025 – 1 Feb 2026).
    expect(
      currentPeriodYearMonth(
        new Date('2026-02-01T05:00:00.000Z'),
        settings({ startDay: 31, weekendAdjust: 'next_workday' }),
      ),
    ).toBe('2025-12');

    // 1 Agu 2026 Sabtu + previous_workday → mulai 31 Jul. Tanggal 31 Jul
    // sudah masuk periode Agustus.
    expect(
      currentPeriodYearMonth(
        new Date('2026-07-31T05:00:00.000Z'),
        settings({ startDay: 1, weekendAdjust: 'previous_workday' }),
      ),
    ).toBe('2026-08');
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
