import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { resolveMoneyContext } from '../money.access';
import { buildMoneyReminders } from './reminders.service';

export class RemindersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ctx = await resolveMoneyContext(req.auth!.personId, req.auth!.familyId);
      const items = await buildMoneyReminders(ctx.workspace.id);
      sendData(res, { items });
    } catch (error) {
      next(error);
    }
  }
}

export const remindersController = new RemindersController();
