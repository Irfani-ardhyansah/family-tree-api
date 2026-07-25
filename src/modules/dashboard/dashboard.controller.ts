import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { dashboardService } from './dashboard.service';

function requireReadFocus(req: Request): NonNullable<Request['readFocus']> {
  if (!req.readFocus) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Read focus context belum di-resolve.');
  }
  return req.readFocus;
}

export class DashboardController {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await dashboardService.get(
        req.auth!.familyId,
        req.auth!.personId,
        requireReadFocus(req),
        req.query,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
