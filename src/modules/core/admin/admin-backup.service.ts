import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { buildPublicUrl, mediaStorage } from '../media/media.storage';
import { adminAuditService } from './admin-audit.service';
import { createBackupJobId } from './admin-backup.id';
import { adminBackupRepository } from './admin-backup.repository';
import { ADMIN_MODULE_IDS, AdminModuleId, isAdminModuleId } from './admin.constants';
import { toIso } from './admin.mapper';
import {
  AdminBackupItem,
  AdminBackupListResponse,
  BackupJobRow,
} from './admin.types';

function parseModuleIdsJson(value: string | string[]): AdminModuleId[] {
  const raw = Array.isArray(value)
    ? value
    : (() => {
        try {
          return JSON.parse(value) as unknown;
        } catch {
          return [];
        }
      })();

  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is AdminModuleId => typeof id === 'string' && isAdminModuleId(id));
}

function toBackupItem(row: BackupJobRow): AdminBackupItem {
  return {
    id: row.id,
    moduleIds: parseModuleIdsJson(row.module_ids),
    createdAt: toIso(row.created_at),
    status: row.status,
    downloadUrl: row.storage_key ? buildPublicUrl(row.storage_key) : null,
    errorMessage: row.error_message,
  };
}

const runningJobs = new Set<string>();

export class AdminBackupService {
  async list(familyId: number): Promise<AdminBackupListResponse> {
    const rows = await adminBackupRepository.listByFamily(familyId);
    return { items: rows.map(toBackupItem) };
  }

  async getById(familyId: number, id: string): Promise<AdminBackupItem> {
    if (!id.startsWith('bak_')) {
      throw new AppError(404, ErrorCodes.ADMIN_BACKUP_NOT_FOUND, 'Backup tidak ditemukan.');
    }
    const row = await adminBackupRepository.findById(familyId, id);
    if (!row) {
      throw new AppError(404, ErrorCodes.ADMIN_BACKUP_NOT_FOUND, 'Backup tidak ditemukan.');
    }
    return toBackupItem(row);
  }

  async create(
    familyId: number,
    personId: number,
    body: Record<string, unknown>,
  ): Promise<AdminBackupItem> {
    const rawIds = body.moduleIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'moduleIds wajib berupa array tidak kosong.',
      );
    }

    const moduleIds = [
      ...new Set(
        rawIds.filter((id): id is AdminModuleId => typeof id === 'string' && isAdminModuleId(id)),
      ),
    ];

    if (moduleIds.length === 0) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        `moduleIds harus salah satu dari: ${ADMIN_MODULE_IDS.join(', ')}.`,
      );
    }

    const id = createBackupJobId();
    await adminBackupRepository.insert({
      id,
      familyId,
      createdByPersonId: personId,
      moduleIds,
    });

    this.enqueue(id);

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'backup',
      summary: `Backup dimulai (${moduleIds.join(', ')})`,
      after: { id, moduleIds, status: 'running' },
    });

    return this.getById(familyId, id);
  }

  private enqueue(jobId: string): void {
    if (runningJobs.has(jobId)) {
      return;
    }
    runningJobs.add(jobId);
    setImmediate(() => {
      void this.runJob(jobId).finally(() => {
        runningJobs.delete(jobId);
      });
    });
  }

  private async runJob(jobId: string): Promise<void> {
    const row = await adminBackupRepository.findByJobId(jobId);
    if (!row || row.status !== 'running') {
      return;
    }

    try {
      const moduleIds = parseModuleIdsJson(row.module_ids);
      const modules: Record<string, unknown> = {};

      for (const moduleId of moduleIds) {
        if (moduleId === 'roots') {
          modules.roots = await adminBackupRepository.loadRootsExport(row.family_id);
        } else if (moduleId === 'core') {
          modules.core = await adminBackupRepository.loadCoreExport(row.family_id);
        } else if (moduleId === 'money') {
          modules.money = { note: 'Money Track belum tersedia — export kosong.' };
        } else if (moduleId === 'household') {
          modules.household = { note: 'Household belum tersedia — export kosong.' };
        }
      }

      const payload = {
        exportedAt: new Date().toISOString(),
        familyId: row.family_id,
        moduleIds,
        modules,
      };

      const storageKey = `backups/${row.family_id}/${jobId}.json`;
      await mediaStorage.save(storageKey, Buffer.from(JSON.stringify(payload, null, 2), 'utf8'));
      await adminBackupRepository.markSuccess(jobId, storageKey);
    } catch (error) {
      if (!env.isProduction) {
        console.error('[AdminBackupService] job failed', jobId, error);
      }
      await adminBackupRepository.markFailed(
        jobId,
        error instanceof Error ? error.message : 'Backup gagal',
      );
    }
  }
}

export const adminBackupService = new AdminBackupService();
