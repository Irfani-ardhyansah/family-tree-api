import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { sendData } from '../../../shared/utils/response';
import { adminAuditService } from './admin-audit.service';
import { adminBackupService } from './admin-backup.service';
import { adminBroadcastService } from './admin-broadcast.service';
import { adminDashboardService } from './admin-dashboard.service';
import { adminSessionsService } from './admin-sessions.service';
import { adminSettingsService } from './admin-settings.service';
import { moduleStatusService } from './module-status.service';

function sessionIdHeader(req: Request): string | undefined {
  const raw = req.headers['x-session-id'];
  return Array.isArray(raw) ? raw[0] : raw;
}

export class AdminController {
  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminDashboardService.get(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listModuleStatuses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await moduleStatusService.list(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async toggleModuleStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await moduleStatusService.toggle(
        req.auth!.familyId,
        req.auth!.personId,
        req.params.moduleId ?? '',
        req.body?.enabled,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminAuditService.list(
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getAuditLog(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminAuditService.getById(req.auth!.familyId, req.params.id ?? '');
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminSessionsService.list(
        req.auth!.familyId,
        req.query as Record<string, unknown>,
        sessionIdHeader(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async revokeSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminSessionsService.revoke(
        req.auth!.familyId,
        req.auth!.personId,
        req.params.sessionId ?? '',
        sessionIdHeader(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const forParam = typeof req.query.for === 'string' ? req.query.for : '';
      if (forParam !== 'broadcast') {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'Query for=broadcast wajib untuk endpoint ini.',
        );
      }
      const data = await adminBroadcastService.listUsers(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listBroadcasts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminBroadcastService.list(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async createBroadcast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminBroadcastService.create(
        req.auth!.familyId,
        req.auth!.personId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminSettingsService.get(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminSettingsService.update(
        req.auth!.familyId,
        req.auth!.personId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async uploadLogo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminSettingsService.uploadLogo(
        req.auth!.familyId,
        req.auth!.personId,
        req.file,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listBackups(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminBackupService.list(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminBackupService.getById(req.auth!.familyId, req.params.id ?? '');
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async createBackup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await adminBackupService.create(
        req.auth!.familyId,
        req.auth!.personId,
        (req.body ?? {}) as Record<string, unknown>,
      );
      sendData(res, data, 202);
    } catch (error) {
      next(error);
    }
  }
}

export const adminController = new AdminController();
