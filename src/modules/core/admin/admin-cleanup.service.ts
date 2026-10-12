import { readFile, stat, writeFile } from 'fs/promises';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { getAppLogFilePath } from '../../../shared/logging/fileLogger';
import { mediaStorage } from '../media/media.storage';
import { LogCategory, LogStatus } from '../logs/logs.types';
import { logsService } from '../logs/logs.service';
import { adminAuditService } from './admin-audit.service';
import {
  adminCleanupRepository,
  DEFAULT_CLEANUP_TARGETS,
  DEFAULT_RETENTION_DAYS,
} from './admin-cleanup.repository';
import { writeCleanupRunReport } from './admin-cleanup.report';
import type {
  AutoCleanupSettings,
  AutoCleanupSettingsRow,
  CleanupDeleted,
  CleanupTargets,
} from './admin.types';

const MAX_RETENTION_DAYS = 3650;

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function scheduleLabel(intervalMinutes: number): string {
  if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
    return 'Nonaktif';
  }
  if (intervalMinutes % 1440 === 0) {
    const days = intervalMinutes / 1440;
    return days === 1 ? 'Setiap hari' : `Setiap ${days} hari`;
  }
  if (intervalMinutes % 60 === 0) {
    return `Setiap ${intervalMinutes / 60} jam`;
  }
  return `Setiap ${intervalMinutes} menit`;
}

function cutoffFrom(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function parseBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw new AppError(422, ErrorCodes.VALIDATION_ERROR, `${field} harus boolean.`);
}

function parseTargets(raw: unknown): CleanupTargets {
  if (!raw || typeof raw !== 'object') {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'targets tidak valid.');
  }
  const input = raw as Record<string, unknown>;
  const targets: CleanupTargets = { ...DEFAULT_CLEANUP_TARGETS };
  for (const key of Object.keys(targets) as (keyof CleanupTargets)[]) {
    if (input[key] !== undefined) {
      targets[key] = parseBoolean(input[key], `targets.${key}`);
    }
  }
  return targets;
}

function emptyDeleted(): CleanupDeleted {
  return {
    appLogs: 0,
    backupHistory: 0,
    backupFiles: 0,
    logFiles: 0,
    freedBytes: 0,
  };
}

type LogFileAnalysis = {
  kept: string[];
  removedLines: number;
  freedBytes: number;
};

/** Baca logs/app.log, pisahkan baris lama (< cutoff) dari yang disimpan. */
async function analyzeLogFile(cutoff: Date): Promise<LogFileAnalysis> {
  const filePath = getAppLogFilePath();
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch {
    return { kept: [], removedLines: 0, freedBytes: 0 };
  }

  const lines = content.split('\n');
  const kept: string[] = [];
  let removedLines = 0;
  let freedBytes = 0;

  for (const line of lines) {
    const match = line.match(/^\[([^\]]+)\]/);
    const parsed = match ? new Date(match[1].replace(' ', 'T')) : null;
    if (parsed && !Number.isNaN(parsed.getTime()) && parsed < cutoff) {
      removedLines += 1;
      freedBytes += Buffer.byteLength(`${line}\n`, 'utf8');
      continue;
    }
    kept.push(line);
  }

  return { kept, removedLines, freedBytes };
}

async function fileSizeOf(storageKey: string): Promise<number> {
  try {
    const info = await stat(mediaStorage.getAbsolutePath(storageKey));
    return info.size;
  } catch {
    return 0;
  }
}

export class AdminCleanupService {
  private toSettings(row: AutoCleanupSettingsRow): AutoCleanupSettings {
    return {
      enabled: row.enabled === true || row.enabled === 1,
      retentionDays: row.retention_days,
      targets: adminCleanupRepository.parseTargets(row.targets),
      minRetentionDays: env.autoCleanup.minRetentionDays,
      scheduleLabel: scheduleLabel(env.autoCleanup.intervalMinutes),
      lastRunAt: toIso(row.last_run_at),
      lastResult: adminCleanupRepository.parseResult<CleanupDeleted>(
        row.last_result,
      ),
    };
  }

  async getSettings(familyId: number): Promise<AutoCleanupSettings> {
    const row = await adminCleanupRepository.ensureSettings(
      familyId,
      env.autoCleanup.defaultEnabled,
    );
    return this.toSettings(row);
  }

  async updateSettings(
    familyId: number,
    personId: number,
    body: unknown,
  ): Promise<AutoCleanupSettings> {
    if (!body || typeof body !== 'object') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Body tidak valid.');
    }
    const raw = body as Record<string, unknown>;
    await adminCleanupRepository.ensureSettings(
      familyId,
      env.autoCleanup.defaultEnabled,
    );

    const patch: {
      enabled?: boolean;
      retention_days?: number;
      targets?: CleanupTargets;
      updated_by?: number;
    } = { updated_by: personId };

    if (raw.enabled !== undefined) {
      patch.enabled = parseBoolean(raw.enabled, 'enabled');
    }
    if (raw.retentionDays !== undefined) {
      const days = Number(raw.retentionDays);
      if (!Number.isInteger(days) || days <= 0 || days > MAX_RETENTION_DAYS) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `retentionDays harus bilangan bulat 1–${MAX_RETENTION_DAYS}.`,
        );
      }
      if (days < env.autoCleanup.minRetentionDays) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          `retentionDays minimal ${env.autoCleanup.minRetentionDays} hari.`,
        );
      }
      patch.retention_days = days;
    }
    if (raw.targets !== undefined) {
      patch.targets = parseTargets(raw.targets);
    }

    const row = await adminCleanupRepository.updateSettings(familyId, patch);

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'settings',
      summary: `Pembersihan otomatis ${patch.enabled === true ? 'diaktifkan' : patch.enabled === false ? 'dinonaktifkan' : 'diubah'}`,
      after: {
        enabled: row.enabled === true || row.enabled === 1,
        retentionDays: row.retention_days,
        targets: adminCleanupRepository.parseTargets(row.targets),
      },
    });

    return this.toSettings(row);
  }

  /** Dry-run: hitung yang akan dihapus tanpa mengubah data. */
  async preview(familyId: number): Promise<CleanupDeleted> {
    const settings = await this.getSettings(familyId);
    const cutoff = cutoffFrom(settings.retentionDays);
    const result = emptyDeleted();

    if (settings.targets.appLogs) {
      result.appLogs = await adminCleanupRepository.countAppLogs(familyId, cutoff);
    }

    const expiredJobs = await adminCleanupRepository.listExpiredBackupJobs(
      familyId,
      cutoff,
    );
    if (settings.targets.backupHistory) {
      result.backupHistory = expiredJobs.length;
    }
    if (settings.targets.backupFiles) {
      for (const job of expiredJobs) {
        if (!job.storage_key) continue;
        result.backupFiles += 1;
        result.freedBytes += await fileSizeOf(job.storage_key);
      }
    }

    if (settings.targets.logFiles) {
      const analysis = await analyzeLogFile(cutoff);
      result.logFiles = analysis.removedLines > 0 ? 1 : 0;
      result.freedBytes += analysis.freedBytes;
    }

    return result;
  }

  /** Jalankan pembersihan sekali. `personId` null = dijalankan scheduler. */
  async run(
    familyId: number,
    personId: number | null,
    trigger: 'manual' | 'auto',
  ): Promise<AutoCleanupSettings> {
    const row = await adminCleanupRepository.ensureSettings(
      familyId,
      env.autoCleanup.defaultEnabled,
    );
    const targets = adminCleanupRepository.parseTargets(row.targets);
    const retentionDays = row.retention_days ?? DEFAULT_RETENTION_DAYS;
    const cutoff = cutoffFrom(retentionDays);
    const result = emptyDeleted();

    if (targets.appLogs) {
      result.appLogs = await adminCleanupRepository.deleteAppLogs(familyId, cutoff);
    }

    const expiredJobs = await adminCleanupRepository.listExpiredBackupJobs(
      familyId,
      cutoff,
    );
    for (const job of expiredJobs) {
      let fileRemoved = true;
      if (targets.backupFiles && job.storage_key) {
        try {
          result.freedBytes += await fileSizeOf(job.storage_key);
          await mediaStorage.remove(job.storage_key);
          result.backupFiles += 1;
        } catch {
          // Gagal hapus file → jangan hapus barisnya supaya bisa di-retry.
          fileRemoved = false;
        }
      }
      if (fileRemoved) {
        await adminCleanupRepository.deleteBackupJob(familyId, job.id);
        result.backupHistory += 1;
      }
    }

    if (targets.logFiles) {
      const analysis = await analyzeLogFile(cutoff);
      if (analysis.removedLines > 0) {
        try {
          await writeFile(getAppLogFilePath(), analysis.kept.join('\n'), 'utf8');
          result.logFiles = 1;
          result.freedBytes += analysis.freedBytes;
        } catch {
          // best-effort
        }
      }
    }

    await adminCleanupRepository.saveRunResult(familyId, result);

    await writeCleanupRunReport({
      trigger,
      familyId,
      personId,
      retentionDays,
      targets,
      cutoff,
      executedAt: new Date(),
      deleted: result,
    });

    const summary = `Pembersihan otomatis (${trigger}): ${result.appLogs} log, ${result.backupHistory} riwayat backup, ${result.backupFiles} file, bebaskan ${result.freedBytes} byte`;

    await logsService.record({
      category: LogCategory.SYSTEM,
      action: 'admin.cleanup.run',
      status: LogStatus.SUCCESS,
      actorPersonId: personId,
      familyId,
      message: summary,
      metadata: result,
    });

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'settings',
      summary,
      after: result as unknown as Record<string, unknown>,
    });

    const updated = await adminCleanupRepository.findSettings(familyId);
    return this.toSettings(updated!);
  }

  /** Dipakai scheduler: pastikan semua keluarga punya baris, jalankan yang aktif. */
  async runAllEnabled(): Promise<void> {
    await adminCleanupRepository.ensureAllFamilies(
      env.autoCleanup.defaultEnabled,
    );
    const rows = await adminCleanupRepository.listEnabled();
    for (const row of rows) {
      try {
        await this.run(row.family_id, null, 'auto');
      } catch (error) {
        if (!env.isProduction) {
          console.error('[admin-cleanup] run failed', row.family_id, error);
        }
      }
    }
  }
}

export const adminCleanupService = new AdminCleanupService();
