import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { debtsService } from './debts.service';

export class DebtsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.list(
          req.auth!.personId,
          req.auth!.familyId,
          req.query as Record<string, unknown>,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.getById(req.auth!.personId, req.auth!.familyId, req.params.id),
      );
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.create(req.auth!.personId, req.auth!.familyId, req.body),
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.update(
          req.auth!.personId,
          req.auth!.familyId,
          req.params.id,
          req.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.remove(req.auth!.personId, req.auth!.familyId, req.params.id),
      );
    } catch (error) {
      next(error);
    }
  }

  async addPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await debtsService.addPayment(
          req.auth!.personId,
          req.auth!.familyId,
          req.params.id,
          req.body,
        ),
        201,
      );
    } catch (error) {
      next(error);
    }
  }
}

export const debtsController = new DebtsController();
