import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { accountsService } from './accounts.service';

export class AccountsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await accountsService.list(
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
      const data = await accountsService.create(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await accountsService.update(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await accountsService.remove(
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

export const accountsController = new AccountsController();
