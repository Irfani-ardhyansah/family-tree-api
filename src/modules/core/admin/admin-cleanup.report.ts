import { appendFile, mkdir } from 'fs/promises';
import path from 'path';
import type { CleanupDeleted, CleanupTargets } from './admin.types';

/**
 * Laporan tiap eksekusi pembersihan otomatis (spec:
 * docs/requests/from-fe/pending/ADMIN-AUTO-CLEANUP-BE-PROMPT.md).
 *
 * Satu file per trigger di `logs/cleanup/` — mencatat jendela penghapusan
 * (cutoff → waktu eksekusi) plus jumlah yang dihapus. Karena scheduler
 * default harian, akumulasi file kecil. Target `logFiles` hanya menyentuh
 * `logs/app.log`, jadi laporan di folder ini tidak ikut terhapus.
 */

const REPORT_DIR = path.resolve(process.cwd(), 'logs', 'cleanup');

export type CleanupRunReport = {
  trigger: 'manual' | 'auto';
  familyId: number;
  personId: number | null;
  retentionDays: number;
  targets: CleanupTargets;
  /** Batas bawah data yang disimpan (data < cutoff dihapus). */
  cutoff: Date;
  /** Waktu eksekusi pembersihan. */
  executedAt: Date;
  deleted: CleanupDeleted;
};

function stamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function fileStamp(date: Date): string {
  // 2026-10-12 21:40:00 → 20261012-214000
  return date.toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
}

export function cleanupReportFileName(executedAt: Date): string {
  return `cleanup-${fileStamp(executedAt)}.log`;
}

export function formatCleanupRunReport(report: CleanupRunReport): string {
  const { targets, deleted } = report;
  const targetLine = [
    `appLogs=${targets.appLogs ? 'on' : 'off'}`,
    `backupHistory=${targets.backupHistory ? 'on' : 'off'}`,
    `backupFiles=${targets.backupFiles ? 'on' : 'off'}`,
    `logFiles=${targets.logFiles ? 'on' : 'off'}`,
  ].join(' ');

  return [
    `# Pembersihan otomatis — ${stamp(report.executedAt)}`,
    `trigger: ${report.trigger}`,
    `family_id: ${report.familyId}`,
    `person_id: ${report.personId ?? '(scheduler)'}`,
    `retention_days: ${report.retentionDays}`,
    `window: ${stamp(report.cutoff)} → ${stamp(report.executedAt)}`,
    `targets: ${targetLine}`,
    `deleted:`,
    `  appLogs: ${deleted.appLogs}`,
    `  backupHistory: ${deleted.backupHistory}`,
    `  backupFiles: ${deleted.backupFiles}`,
    `  logFiles: ${deleted.logFiles}`,
    `  freedBytes: ${deleted.freedBytes}`,
    '',
  ].join('\n');
}

/** Best-effort: gagal tulis laporan jangan sampai menggagalkan pembersihan. */
export async function writeCleanupRunReport(
  report: CleanupRunReport,
): Promise<string | null> {
  try {
    await mkdir(REPORT_DIR, { recursive: true });
    const filePath = path.join(REPORT_DIR, cleanupReportFileName(report.executedAt));
    await appendFile(filePath, formatCleanupRunReport(report), 'utf8');
    return filePath;
  } catch {
    return null;
  }
}
