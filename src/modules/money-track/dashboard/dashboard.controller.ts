import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { moneyDashboardService } from './dashboard.service';

export class MoneyDashboardController {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await moneyDashboardService.get(
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

export const moneyDashboardController = new MoneyDashboardController();
