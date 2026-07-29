import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { balancingService } from './balancing.service';

export class BalancingController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await balancingService.list(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async check(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await balancingService.check(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async adjust(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await balancingService.adjust(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async openingBalances(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await balancingService.openingBalances(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const balancingController = new BalancingController();
