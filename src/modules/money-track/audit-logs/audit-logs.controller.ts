import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { auditLogsService } from './audit-logs.service';

export class AuditLogsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await auditLogsService.list(
        req.auth!.personId,
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await auditLogsService.getById(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogsController = new AuditLogsController();
