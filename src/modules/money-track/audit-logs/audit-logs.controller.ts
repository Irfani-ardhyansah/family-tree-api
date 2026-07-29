import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { auditLogsService } from './audit-logs.service';

export class AuditLogsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await auditLogsService.list(
          req.auth!.personId,
          req.auth!.familyId,
          req.query as Record<string, unknown>,
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogsController = new AuditLogsController();
