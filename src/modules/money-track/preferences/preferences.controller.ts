import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { preferencesService } from './preferences.service';

export class PreferencesController {
  async get(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await preferencesService.get(req.auth!.personId, req.auth!.familyId),
      );
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await preferencesService.update(
          req.auth!.personId,
          req.auth!.familyId,
          req.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const preferencesController = new PreferencesController();
