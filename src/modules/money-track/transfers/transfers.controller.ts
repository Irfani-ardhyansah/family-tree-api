import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { transfersService } from './transfers.service';

export class TransfersController {
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await transfersService.getById(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await transfersService.create(
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
      const data = await transfersService.remove(
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

export const transfersController = new TransfersController();
