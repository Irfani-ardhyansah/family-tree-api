import { describe, expect, it } from 'vitest';
import {
  cleanupReportFileName,
  formatCleanupRunReport,
  type CleanupRunReport,
} from './admin-cleanup.report';

function report(overrides: Partial<CleanupRunReport> = {}): CleanupRunReport {
  return {
    trigger: 'auto',
    familyId: 3,
    personId: null,
    retentionDays: 14,
    targets: { appLogs: true, backupHistory: true, backupFiles: true, logFiles: false },
    cutoff: new Date('2026-09-28T14:40:00.000Z'),
    executedAt: new Date('2026-10-12T14:40:00.000Z'),
    deleted: {
      appLogs: 12,
      backupHistory: 2,
      backupFiles: 2,
      logFiles: 0,
      freedBytes: 20480,
    },
    ...overrides,
  };
}

describe('formatCleanupRunReport', () => {
  it('mencatat jendela penghapusan (cutoff → eksekusi) + jumlah', () => {
    const text = formatCleanupRunReport(report());

    expect(text).toContain('# Pembersihan otomatis — 2026-10-12 14:40:00');
    expect(text).toContain('trigger: auto');
    expect(text).toContain('family_id: 3');
    expect(text).toContain('person_id: (scheduler)');
    expect(text).toContain('window: 2026-09-28 14:40:00 → 2026-10-12 14:40:00');
    expect(text).toContain('targets: appLogs=on backupHistory=on backupFiles=on logFiles=off');
    expect(text).toContain('appLogs: 12');
    expect(text).toContain('freedBytes: 20480');
  });

  it('menampilkan person_id manual kalau dijalankan admin', () => {
    const text = formatCleanupRunReport(report({ trigger: 'manual', personId: 7 }));

    expect(text).toContain('trigger: manual');
    expect(text).toContain('person_id: 7');
  });
});

describe('cleanupReportFileName', () => {
  it('satu file per waktu eksekusi', () => {
    expect(cleanupReportFileName(new Date('2026-10-12T14:40:05.000Z'))).toBe(
      'cleanup-20261012-144005.log',
    );
  });
});
