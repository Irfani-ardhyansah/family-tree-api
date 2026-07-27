import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { pushService } from './push.service';

export class PushController {
  async getVapidPublicKey(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, pushService.getVapidPublicKey());
    } catch (error) {
      next(error);
    }
  }

  async subscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pushService.subscribe(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
        req.headers['user-agent'] ?? null,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async unsubscribe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pushService.unsubscribe(req.auth!.personId, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const pushController = new PushController();
