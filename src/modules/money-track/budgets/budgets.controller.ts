import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { budgetsService } from './budgets.service';

export class BudgetsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await budgetsService.list(
          req.auth!.personId,
          req.auth!.familyId,
          req.query as Record<string, unknown>,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await budgetsService.upsert(req.auth!.personId, req.auth!.familyId, req.body),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const budgetsController = new BudgetsController();
