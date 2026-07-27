import db from '../../../config/database';
import { Tables } from '../../../shared/database/tables';
import { ADMIN_MODULE_IDS, AdminModuleId } from './admin.constants';
import { FamilyAccessRow, ModuleStatusRow } from './admin.types';

export class ModuleStatusRepository {
  async listByFamily(familyId: number): Promise<ModuleStatusRow[]> {
    return db(`${Tables.MODULE_STATUSES} as m`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'm.updated_by_person_id')
      .where('m.family_id', familyId)
      .select<ModuleStatusRow[]>([
        'm.id',
        'm.family_id',
        'm.module_id',
        'm.enabled',
        'm.updated_by_person_id',
        'p.full_name as updated_by_name',
        'm.updated_at',
        'm.created_at',
      ])
      .orderBy('m.module_id', 'asc');
  }

  async ensureDefaults(familyId: number): Promise<void> {
    const existing = await db(Tables.MODULE_STATUSES)
      .where({ family_id: familyId })
      .pluck<AdminModuleId>('module_id');

    const missing = ADMIN_MODULE_IDS.filter((id) => !existing.includes(id));
    if (missing.length === 0) {
      return;
    }

    await db(Tables.MODULE_STATUSES).insert(
      missing.map((moduleId) => ({
        family_id: familyId,
        module_id: moduleId,
        enabled: true,
        updated_by_person_id: null,
      })),
    );
  }

  async findByModule(
    familyId: number,
    moduleId: AdminModuleId,
  ): Promise<ModuleStatusRow | undefined> {
    return db(`${Tables.MODULE_STATUSES} as m`)
      .leftJoin(`${Tables.PERSONS} as p`, 'p.id', 'm.updated_by_person_id')
      .where({ 'm.family_id': familyId, 'm.module_id': moduleId })
      .first<ModuleStatusRow>([
        'm.id',
        'm.family_id',
        'm.module_id',
        'm.enabled',
        'm.updated_by_person_id',
        'p.full_name as updated_by_name',
        'm.updated_at',
        'm.created_at',
      ]);
  }

  async setEnabled(input: {
    familyId: number;
    moduleId: AdminModuleId;
    enabled: boolean;
    updatedByPersonId: number;
  }): Promise<void> {
    await db(Tables.MODULE_STATUSES)
      .where({ family_id: input.familyId, module_id: input.moduleId })
      .update({
        enabled: input.enabled,
        updated_by_person_id: input.updatedByPersonId,
        updated_at: db.fn.now(),
      });
  }

  async getAccessVersion(familyId: number): Promise<number> {
    const row = await db(Tables.FAMILIES)
      .where({ id: familyId })
      .first<FamilyAccessRow>('id', 'access_version');
    return Number(row?.access_version ?? 1);
  }

  async bumpAccessVersion(familyId: number): Promise<number> {
    await db(Tables.FAMILIES).where({ id: familyId }).increment('access_version', 1);
    return this.getAccessVersion(familyId);
  }
}

export const moduleStatusRepository = new ModuleStatusRepository();
