import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { adminAuditService } from './admin-audit.service';
import { MODULE_LABELS, isAdminModuleId } from './admin.constants';
import { toModuleStatusItem } from './admin.mapper';
import { moduleStatusRepository } from './module-status.repository';
import { ModuleStatusItem, ModuleStatusListResponse } from './admin.types';

export class ModuleStatusService {
  async list(familyId: number): Promise<ModuleStatusListResponse> {
    await moduleStatusRepository.ensureDefaults(familyId);
    const rows = await moduleStatusRepository.listByFamily(familyId);
    return { items: rows.map(toModuleStatusItem) };
  }

  async getEnabledMap(familyId: number): Promise<Record<string, boolean>> {
    const { items } = await this.list(familyId);
    return Object.fromEntries(items.map((item) => [item.moduleId, item.enabled]));
  }

  async getAccessVersion(familyId: number): Promise<number> {
    return moduleStatusRepository.getAccessVersion(familyId);
  }

  async toggle(
    familyId: number,
    personId: number,
    moduleIdRaw: string,
    enabledRaw: unknown,
  ): Promise<ModuleStatusItem> {
    if (!isAdminModuleId(moduleIdRaw)) {
      throw new AppError(404, ErrorCodes.ADMIN_MODULE_NOT_FOUND, 'Modul tidak ditemukan.');
    }
    if (typeof enabledRaw !== 'boolean') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'enabled harus boolean.');
    }

    await moduleStatusRepository.ensureDefaults(familyId);
    const current = await moduleStatusRepository.findByModule(familyId, moduleIdRaw);
    if (!current) {
      throw new AppError(404, ErrorCodes.ADMIN_MODULE_NOT_FOUND, 'Modul tidak ditemukan.');
    }

    const beforeEnabled = Boolean(current.enabled);
    if (beforeEnabled === enabledRaw) {
      return toModuleStatusItem(current);
    }

    await moduleStatusRepository.setEnabled({
      familyId,
      moduleId: moduleIdRaw,
      enabled: enabledRaw,
      updatedByPersonId: personId,
    });
    await moduleStatusRepository.bumpAccessVersion(familyId);

    const updated = await moduleStatusRepository.findByModule(familyId, moduleIdRaw);
    if (!updated) {
      throw new AppError(404, ErrorCodes.ADMIN_MODULE_NOT_FOUND, 'Modul tidak ditemukan.');
    }

    const label = MODULE_LABELS[moduleIdRaw];
    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'toggle_module',
      summary: enabledRaw ? `${label} diaktifkan` : `${label} dimatikan`,
      before: { enabled: beforeEnabled },
      after: { enabled: enabledRaw, moduleId: moduleIdRaw },
    });

    return toModuleStatusItem(updated);
  }
}

export const moduleStatusService = new ModuleStatusService();
