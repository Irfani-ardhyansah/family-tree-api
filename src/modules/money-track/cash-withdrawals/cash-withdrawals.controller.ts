import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { cashWithdrawalsService } from './cash-withdrawals.service';

export class CashWithdrawalsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await cashWithdrawalsService.list(
        req.auth!.personId,
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await cashWithdrawalsService.create(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await cashWithdrawalsService.remove(
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

export const cashWithdrawalsController = new CashWithdrawalsController();
