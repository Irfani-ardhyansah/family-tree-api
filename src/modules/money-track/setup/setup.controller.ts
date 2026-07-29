import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { setupService } from './setup.service';

export class SetupController {
  async getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await setupService.getStatus(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async bootstrapPersons(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await setupService.bootstrapPersons(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async coupleLink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await setupService.coupleLink(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async coupleUnlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await setupService.coupleUnlink(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const setupController = new SetupController();
