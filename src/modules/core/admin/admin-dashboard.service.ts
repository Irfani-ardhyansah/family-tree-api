import { adminAuditRepository } from './admin-audit.repository';
import { adminBroadcastRepository } from './admin-broadcast.repository';
import { adminSessionsRepository } from './admin-sessions.repository';
import { toAdminAuditLogEntry } from './admin.mapper';
import { moduleStatusService } from './module-status.service';
import { AdminDashboardResponse } from './admin.types';

export class AdminDashboardService {
  async get(familyId: number): Promise<AdminDashboardResponse> {
    const [userCount, activeSessionCount, modules, recentRows] = await Promise.all([
      adminBroadcastRepository.countAliveMembers(familyId),
      adminSessionsRepository.countActive(familyId),
      moduleStatusService.list(familyId),
      adminAuditRepository.findByFilters(familyId, {
        page: 1,
        pageSize: 8,
      }),
    ]);

    const modulesEnabled = modules.items.filter((item) => item.enabled).length;

    return {
      userCount,
      activeSessionCount,
      modulesEnabled,
      modulesTotal: modules.items.length,
      recentLogs: recentRows.map(toAdminAuditLogEntry),
    };
  }
}

export const adminDashboardService = new AdminDashboardService();
