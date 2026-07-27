import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { AdminBackupStatus, AdminModuleId, BackupJobRow } from './admin.types';

export class AdminBackupRepository {
  async insert(input: {
    id: string;
    familyId: number;
    createdByPersonId: number;
    moduleIds: AdminModuleId[];
  }): Promise<void> {
    await db(Tables.BACKUP_JOBS).insert({
      id: input.id,
      family_id: input.familyId,
      created_by_person_id: input.createdByPersonId,
      module_ids: JSON.stringify(input.moduleIds),
      status: 'running',
    });
  }

  async listByFamily(familyId: number): Promise<BackupJobRow[]> {
    return db(Tables.BACKUP_JOBS)
      .where({ family_id: familyId })
      .orderBy('created_at', 'desc')
      .select<BackupJobRow[]>('*');
  }

  async findById(familyId: number, id: string): Promise<BackupJobRow | undefined> {
    return db(Tables.BACKUP_JOBS).where({ family_id: familyId, id }).first<BackupJobRow>();
  }

  async findByJobId(id: string): Promise<BackupJobRow | undefined> {
    return db(Tables.BACKUP_JOBS).where({ id }).first<BackupJobRow>();
  }

  async markSuccess(id: string, storageKey: string): Promise<void> {
    await db(Tables.BACKUP_JOBS).where({ id }).update({
      status: 'success' satisfies AdminBackupStatus,
      storage_key: storageKey,
      error_message: null,
      finished_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await db(Tables.BACKUP_JOBS).where({ id }).update({
      status: 'failed' satisfies AdminBackupStatus,
      error_message: errorMessage.slice(0, 512),
      finished_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  async loadRootsExport(familyId: number): Promise<Record<string, unknown>> {
    const persons = await db(Tables.PERSONS)
      .where({ family_id: familyId })
      .whereNull('deleted_at')
      .select('*');
    const personIds = persons.map((p: { id: number }) => p.id);

    const [details, lineage, spouses, addresses] = await Promise.all([
      personIds.length
        ? db(Tables.PERSON_DETAILS).whereIn('person_id', personIds).select('*')
        : Promise.resolve([]),
      personIds.length
        ? db(Tables.PERSON_LINEAGE).whereIn('person_id', personIds).select('*')
        : Promise.resolve([]),
      personIds.length
        ? db(Tables.PERSON_SPOUSES)
            .where(function spouseScope() {
              this.whereIn('person_id_a', personIds).orWhereIn('person_id_b', personIds);
            })
            .select('*')
        : Promise.resolve([]),
      personIds.length
        ? db(Tables.PERSON_ADDRESSES).whereIn('person_id', personIds).select('*')
        : Promise.resolve([]),
    ]);

    return { persons, details, lineage, spouses, addresses };
  }

  async loadCoreExport(familyId: number): Promise<Record<string, unknown>> {
    const [family, members, moduleStatuses] = await Promise.all([
      db(Tables.FAMILIES).where({ id: familyId }).first(),
      db(Tables.FAMILY_MEMBERS).where({ family_id: familyId }).select('*'),
      db(Tables.MODULE_STATUSES).where({ family_id: familyId }).select('*'),
    ]);
    return { family, members, moduleStatuses };
  }
}

export const adminBackupRepository = new AdminBackupRepository();
