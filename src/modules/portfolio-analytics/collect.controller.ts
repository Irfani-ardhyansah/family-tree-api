import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { collectService } from './collect.service';

export class CollectController {
  async collect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await collectService.collect(req);
      sendData(res, data, 202);
    } catch (error) {
      next(error);
    }
  }
}

export const collectController = new CollectController();
