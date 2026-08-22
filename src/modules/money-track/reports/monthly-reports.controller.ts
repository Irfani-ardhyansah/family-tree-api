import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { monthlyReportsService } from './monthly-reports.service';

export class MonthlyReportsController {
  async monthly(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await monthlyReportsService.monthly(
        req.auth!.personId,
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const monthlyReportsController = new MonthlyReportsController();
