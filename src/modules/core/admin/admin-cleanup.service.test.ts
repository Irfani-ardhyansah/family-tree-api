import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./admin-cleanup.repository', () => ({
  adminCleanupRepository: {
    findSettings: vi.fn(),
    ensureSettings: vi.fn(),
    ensureAllFamilies: vi.fn(),
    listEnabled: vi.fn(),
    updateSettings: vi.fn(),
    saveRunResult: vi.fn(),
    countAppLogs: vi.fn(),
    deleteAppLogs: vi.fn(),
    listExpiredBackupJobs: vi.fn(),
    deleteBackupJob: vi.fn(),
    parseTargets: vi.fn((value: unknown) => ({
      appLogs: true,
      backupHistory: true,
      backupFiles: true,
      logFiles: false,
      ...(typeof value === 'string' ? JSON.parse(value) : (value as object)),
    })),
    parseResult: vi.fn((value: unknown) =>
      value == null
        ? null
        : typeof value === 'string'
          ? JSON.parse(value)
          : value,
    ),
  },
  DEFAULT_CLEANUP_TARGETS: {
    appLogs: true,
    backupHistory: true,
    backupFiles: true,
    logFiles: false,
  },
  DEFAULT_RETENTION_DAYS: 14,
}));

vi.mock('./admin-audit.service', () => ({
  adminAuditService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../logs/logs.service', () => ({
  logsService: { record: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../media/media.storage', () => ({
  mediaStorage: {
    remove: vi.fn().mockResolvedValue(undefined),
    getAbsolutePath: vi.fn((key: string) => `/tmp/${key}`),
  },
}));

vi.mock('../../../shared/logging/fileLogger', () => ({
  getAppLogFilePath: vi.fn(() => '/tmp/app.log'),
}));

vi.mock('fs/promises', () => ({
  readFile: vi.fn().mockRejectedValue(new Error('no file')),
  stat: vi.fn().mockResolvedValue({ size: 1000 }),
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

import { adminAuditService } from './admin-audit.service';
import { adminCleanupRepository } from './admin-cleanup.repository';
import { adminCleanupService } from './admin-cleanup.service';

const familyId = 3;
const personId = 7;

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    family_id: familyId,
    enabled: false,
    retention_days: 14,
    targets: JSON.stringify({
      appLogs: true,
      backupHistory: true,
      backupFiles: true,
      logFiles: false,
    }),
    last_run_at: null,
    last_result: null,
    updated_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminCleanupRepository.ensureSettings).mockResolvedValue(
    settingsRow() as never,
  );
});

describe('getSettings', () => {
  it('mengembalikan default + minRetentionDays', async () => {
    const settings = await adminCleanupService.getSettings(familyId);

    expect(settings.enabled).toBe(false);
    expect(settings.retentionDays).toBe(14);
    expect(settings.targets.appLogs).toBe(true);
    expect(settings.targets.logFiles).toBe(false);
    expect(settings.minRetentionDays).toBeGreaterThanOrEqual(1);
    expect(settings.scheduleLabel).toBeTruthy();
  });
});

describe('updateSettings', () => {
  it('menolak retentionDays di bawah batas aman', async () => {
    await expect(
      adminCleanupService.updateSettings(familyId, personId, {
        retentionDays: 2,
      }),
    ).rejects.toThrow(/minimal/);
  });

  it('menolak enabled yang bukan boolean', async () => {
    await expect(
      adminCleanupService.updateSettings(familyId, personId, { enabled: 'yes' }),
    ).rejects.toThrow(/enabled harus boolean/);
  });

  it('menyimpan + mencatat audit saat valid', async () => {
    vi.mocked(adminCleanupRepository.updateSettings).mockResolvedValue(
      settingsRow({
        enabled: 1,
        retention_days: 30,
      }) as never,
    );

    const settings = await adminCleanupService.updateSettings(
      familyId,
      personId,
      { enabled: true, retentionDays: 30 },
    );

    expect(adminCleanupRepository.updateSettings).toHaveBeenCalledWith(
      familyId,
      expect.objectContaining({ enabled: true, retention_days: 30 }),
    );
    expect(adminAuditService.record).toHaveBeenCalled();
    expect(settings.enabled).toBe(true);
    expect(settings.retentionDays).toBe(30);
  });
});

describe('run', () => {
  it('menghapus log + file backup sesuai target dan menyimpan hasil', async () => {
    vi.mocked(adminCleanupRepository.deleteAppLogs).mockResolvedValue(3);
    vi.mocked(adminCleanupRepository.listExpiredBackupJobs).mockResolvedValue([
      { id: 'bak_1', storage_key: 'backups/3/bak_1.json', status: 'success' },
    ]);
    vi.mocked(adminCleanupRepository.deleteBackupJob).mockResolvedValue(1);
    vi.mocked(adminCleanupRepository.findSettings).mockResolvedValue(
      settingsRow({ enabled: 1 }) as never,
    );

    const result = await adminCleanupService.run(familyId, personId, 'manual');

    expect(result).toBeTruthy();
    expect(adminCleanupRepository.deleteAppLogs).toHaveBeenCalled();
    expect(adminCleanupRepository.deleteBackupJob).toHaveBeenCalledWith(
      familyId,
      'bak_1',
    );
    expect(adminCleanupRepository.saveRunResult).toHaveBeenCalledWith(
      familyId,
      expect.objectContaining({ appLogs: 3, backupHistory: 1, backupFiles: 1 }),
    );
  });
});
