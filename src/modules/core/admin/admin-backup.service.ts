import { readFile } from 'fs/promises';
import path from 'path';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { buildPublicUrl, mediaStorage } from '../media/media.storage';
import { adminAuditService } from './admin-audit.service';
import {
  importBackupReplaceFamily,
  parseBackupPayload,
  type BackupImportResult,
} from './admin-backup-import.service';
import { createBackupJobId } from './admin-backup.id';
import { adminBackupRepository } from './admin-backup.repository';
import { createSqlZipDump, restoreSqlArchive } from './admin-sql-backup.service';
import { ADMIN_MODULE_IDS, AdminModuleId, isAdminModuleId } from './admin.constants';
import { toIso } from './admin.mapper';
import {
  AdminBackupFormat,
  AdminBackupItem,
  AdminBackupListResponse,
  BackupJobRow,
} from './admin.types';
import { looksLikeGzip, looksLikeZip } from './sql-archive.util';

function parseRawModuleIds(value: string | string[]): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function jobFormat(row: BackupJobRow): AdminBackupFormat {
  const raw = parseRawModuleIds(row.module_ids);
  return raw.includes('sql') ? 'sql' : 'json';
}

function parseModuleIdsJson(value: string | string[]): AdminModuleId[] {
  return parseRawModuleIds(value).filter(
    (id): id is AdminModuleId => typeof id === 'string' && isAdminModuleId(id),
  );
}

function toBackupItem(row: BackupJobRow): AdminBackupItem {
  return {
    id: row.id,
    format: jobFormat(row),
    moduleIds: parseModuleIdsJson(row.module_ids),
    createdAt: toIso(row.created_at),
    status: row.status,
    downloadUrl: row.storage_key ? buildPublicUrl(row.storage_key) : null,
    errorMessage: row.error_message,
  };
}

const runningJobs = new Set<string>();

export type SqlImportResult = {
  mode: 'sql';
  database: string;
};

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

  async getDownloadFile(
    familyId: number,
    id: string,
  ): Promise<{ absolutePath: string; filename: string }> {
    const row = await adminBackupRepository.findById(familyId, id);
    if (!row || row.status !== 'success' || !row.storage_key) {
      throw new AppError(404, ErrorCodes.ADMIN_BACKUP_NOT_FOUND, 'File backup tidak ditemukan.');
    }
    return {
      absolutePath: mediaStorage.getAbsolutePath(row.storage_key),
      filename: path.basename(row.storage_key),
    };
  }

  async create(
    familyId: number,
    personId: number,
    body: Record<string, unknown>,
  ): Promise<AdminBackupItem> {
    const format: AdminBackupFormat = body.format === 'sql' ? 'sql' : 'json';

    if (format === 'sql') {
      const id = createBackupJobId();
      await adminBackupRepository.insert({
        id,
        familyId,
        createdByPersonId: personId,
        moduleIds: ['sql'],
      });

      this.enqueue(id);

      await adminAuditService.record({
        familyId,
        actorPersonId: personId,
        moduleId: 'admin',
        action: 'backup',
        summary: 'Backup SQL (full DB .sql.zip) dimulai',
        after: { id, format: 'sql', status: 'running' },
      });

      return this.getById(familyId, id);
    }

    const rawIds = body.moduleIds;
    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'moduleIds wajib berupa array tidak kosong (atau kirim format: "sql").',
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
      summary: `Backup JSON dimulai (${moduleIds.join(', ')})`,
      after: { id, format: 'json', moduleIds, status: 'running' },
    });

    return this.getById(familyId, id);
  }

  async importJson(
    familyId: number,
    personId: number,
    raw: unknown,
  ): Promise<BackupImportResult> {
    let payload;
    try {
      payload = parseBackupPayload(raw);
    } catch (error) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        error instanceof Error ? error.message : 'File backup tidak valid.',
      );
    }

    try {
      const result = await importBackupReplaceFamily(familyId, payload, {
        keepAdminPersonId: personId,
      });

      await adminAuditService.record({
        familyId,
        actorPersonId: personId,
        moduleId: 'admin',
        action: 'backup',
        summary: `Import backup JSON (replace) — ${result.personsImported} persons`,
        after: result as unknown as Record<string, unknown>,
      });

      return result;
    } catch (error) {
      if (!env.isProduction) {
        console.error('[AdminBackupService] import failed', error);
      }
      throw new AppError(
        500,
        ErrorCodes.ADMIN_BACKUP_IMPORT_FAILED,
        error instanceof Error ? error.message : 'Import backup gagal.',
      );
    }
  }

  async importSql(
    familyId: number,
    personId: number,
    buf: Buffer,
    filename: string,
  ): Promise<SqlImportResult> {
    try {
      await restoreSqlArchive(buf, filename);
      const result: SqlImportResult = { mode: 'sql', database: env.db.name };
      await adminAuditService.record({
        familyId,
        actorPersonId: personId,
        moduleId: 'admin',
        action: 'backup',
        summary: `Import backup SQL — ${filename}`,
        after: result as unknown as Record<string, unknown>,
      });
      return result;
    } catch (error) {
      if (!env.isProduction) {
        console.error('[AdminBackupService] SQL import failed', error);
      }
      throw new AppError(
        500,
        ErrorCodes.ADMIN_BACKUP_IMPORT_FAILED,
        error instanceof Error ? error.message : 'Import SQL gagal.',
      );
    }
  }

  /** Auto-detect JSON vs SQL archive from uploaded file. */
  async importFile(
    familyId: number,
    personId: number,
    file?: Express.Multer.File,
  ): Promise<BackupImportResult | SqlImportResult> {
    if (!file?.buffer) {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'File backup wajib (field file): .json, .sql.zip, .sql.gz, atau .sql.',
      );
    }

    const name = file.originalname || '';
    const lower = name.toLowerCase();
    const buf = file.buffer;

    const isSql =
      lower.endsWith('.sql.zip') ||
      lower.endsWith('.sql.gz') ||
      lower.endsWith('.sql') ||
      lower.endsWith('.zip') ||
      lower.endsWith('.gz') ||
      looksLikeZip(buf) ||
      looksLikeGzip(buf);

    if (isSql && !lower.endsWith('.json')) {
      // ZIP/gzip could theoretically be JSON — but our exports use .sql.zip / .json
      if (lower.endsWith('.json.zip')) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'JSON di-zip belum didukung. Upload .json atau .sql.zip.',
        );
      }
      return this.importSql(familyId, personId, buf, name || 'backup.sql.zip');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(buf.toString('utf8')) as unknown;
    } catch {
      throw new AppError(
        422,
        ErrorCodes.VALIDATION_ERROR,
        'File bukan JSON valid. Untuk SQL pakai .sql.zip / .sql.gz / .sql.',
      );
    }
    return this.importJson(familyId, personId, parsed);
  }

  /** @deprecated use importFile */
  async importJsonFile(
    familyId: number,
    personId: number,
    file?: Express.Multer.File,
  ): Promise<BackupImportResult | SqlImportResult> {
    return this.importFile(familyId, personId, file);
  }

  /** CLI helper: import from disk path into familyId. */
  async importJsonFromPath(familyId: number, filePath: string): Promise<BackupImportResult> {
    const text = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(text) as unknown;
    return importBackupReplaceFamily(familyId, parseBackupPayload(parsed));
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
      if (jobFormat(row) === 'sql') {
        const { zip } = await createSqlZipDump();
        const storageKey = `backups/${row.family_id}/${jobId}.sql.zip`;
        await mediaStorage.save(storageKey, zip);
        await adminBackupRepository.markSuccess(jobId, storageKey);
        return;
      }

      const moduleIds = parseModuleIdsJson(row.module_ids);
      const modules: Record<string, unknown> = {};

      for (const moduleId of moduleIds) {
        if (moduleId === 'roots') {
          modules.roots = await adminBackupRepository.loadRootsExport(row.family_id);
        } else if (moduleId === 'core') {
          modules.core = await adminBackupRepository.loadCoreExport(row.family_id);
        } else if (moduleId === 'money') {
          modules.money = {
            note: 'Money Track belum di JSON backup — pakai format sql (.sql.zip) untuk full clone.',
          };
        } else if (moduleId === 'household') {
          modules.household = {
            note: 'Household belum di JSON backup — pakai format sql (.sql.zip) untuk full clone.',
          };
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
