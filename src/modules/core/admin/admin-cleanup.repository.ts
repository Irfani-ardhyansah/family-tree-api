import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import type {
  AutoCleanupSettingsRow,
  CleanupTargets,
} from './admin.types';

export const DEFAULT_CLEANUP_TARGETS: CleanupTargets = {
  appLogs: true,
  backupHistory: true,
  backupFiles: true,
  logFiles: false,
};

export const DEFAULT_RETENTION_DAYS = 14;

function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

export type ExpiredBackupJob = {
  id: string;
  storage_key: string | null;
  status: string;
};

export class AdminCleanupRepository {
  async findSettings(familyId: number): Promise<AutoCleanupSettingsRow | undefined> {
    return db(Tables.AUTO_CLEANUP_SETTINGS)
      .where({ family_id: familyId })
      .first<AutoCleanupSettingsRow>('*');
  }

  /** Pastikan baris settings ada (INSERT IGNORE) — kembalikan barisnya. */
  async ensureSettings(
    familyId: number,
    defaultEnabled: boolean,
  ): Promise<AutoCleanupSettingsRow> {
    await db(Tables.AUTO_CLEANUP_SETTINGS)
      .insert({
        family_id: familyId,
        enabled: defaultEnabled,
        retention_days: DEFAULT_RETENTION_DAYS,
        targets: JSON.stringify(DEFAULT_CLEANUP_TARGETS),
      })
      .onConflict('family_id')
      .ignore();

    const row = await this.findSettings(familyId);
    return row!;
  }

  /** Buat baris default untuk semua keluarga yang belum punya (untuk scheduler). */
  async ensureAllFamilies(defaultEnabled: boolean): Promise<void> {
    const families = await db(Tables.FAMILIES).select<Array<{ id: number }>>('id');
    if (families.length === 0) return;

    await db(Tables.AUTO_CLEANUP_SETTINGS)
      .insert(
        families.map((family) => ({
          family_id: family.id,
          enabled: defaultEnabled,
          retention_days: DEFAULT_RETENTION_DAYS,
          targets: JSON.stringify(DEFAULT_CLEANUP_TARGETS),
        })),
      )
      .onConflict('family_id')
      .ignore();
  }

  async listEnabled(): Promise<AutoCleanupSettingsRow[]> {
    return db(Tables.AUTO_CLEANUP_SETTINGS)
      .where({ enabled: true })
      .select<AutoCleanupSettingsRow[]>('*');
  }

  async updateSettings(
    familyId: number,
    patch: {
      enabled?: boolean;
      retention_days?: number;
      targets?: CleanupTargets;
      updated_by?: number | null;
    },
  ): Promise<AutoCleanupSettingsRow> {
    const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
    if (patch.enabled !== undefined) updateData.enabled = patch.enabled;
    if (patch.retention_days !== undefined) {
      updateData.retention_days = patch.retention_days;
    }
    if (patch.targets !== undefined) {
      updateData.targets = JSON.stringify(patch.targets);
    }
    if (patch.updated_by !== undefined) updateData.updated_by = patch.updated_by;

    await db(Tables.AUTO_CLEANUP_SETTINGS)
      .where({ family_id: familyId })
      .update(updateData);

    const row = await this.findSettings(familyId);
    return row!;
  }

  async saveRunResult(
    familyId: number,
    lastResult: unknown,
  ): Promise<void> {
    await db(Tables.AUTO_CLEANUP_SETTINGS)
      .where({ family_id: familyId })
      .update({
        last_run_at: db.fn.now(),
        last_result: JSON.stringify(lastResult),
        updated_at: db.fn.now(),
      });
  }

  /* --------------------------- Pembersihan --------------------------- */

  async countAppLogs(familyId: number, cutoff: Date): Promise<number> {
    const [row] = await db(Tables.APP_LOGS)
      .where('occurred_at', '<', cutoff)
      .andWhere((builder) =>
        builder.where({ family_id: familyId }).orWhereNull('family_id'),
      )
      .count<Array<{ total: number | string }>>({ total: '*' });
    return Number(row?.total ?? 0);
  }

  async deleteAppLogs(familyId: number, cutoff: Date): Promise<number> {
    return db(Tables.APP_LOGS)
      .where('occurred_at', '<', cutoff)
      .andWhere((builder) =>
        builder.where({ family_id: familyId }).orWhereNull('family_id'),
      )
      .del();
  }

  async listExpiredBackupJobs(
    familyId: number,
    cutoff: Date,
  ): Promise<ExpiredBackupJob[]> {
    return db(Tables.BACKUP_JOBS)
      .where({ family_id: familyId })
      .where('created_at', '<', cutoff)
      .select<ExpiredBackupJob[]>(['id', 'storage_key', 'status']);
  }

  async deleteBackupJob(familyId: number, id: string): Promise<number> {
    return db(Tables.BACKUP_JOBS).where({ family_id: familyId, id }).del();
  }

  /** Parse kolom JSON (dipakai service). */
  parseTargets(value: unknown): CleanupTargets {
    const parsed = parseJson<Partial<CleanupTargets>>(value, {});
    return { ...DEFAULT_CLEANUP_TARGETS, ...parsed };
  }

  parseResult<T>(value: unknown): T | null {
    return parseJson<T | null>(value, null);
  }
}

export const adminCleanupRepository = new AdminCleanupRepository();
