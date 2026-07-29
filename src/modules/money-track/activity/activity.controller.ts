import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { activityService } from './activity.service';

export class ActivityController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await activityService.list(
          req.auth!.personId,
          req.auth!.familyId,
          req.query as Record<string, unknown>,
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const activityController = new ActivityController();
