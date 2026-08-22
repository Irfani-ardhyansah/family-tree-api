import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { calendarEventTypesService } from './calendar-event-types.service';

export class CalendarEventTypesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await calendarEventTypesService.list(
        req.auth!.personId,
        req.auth!.familyId,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await calendarEventTypesService.create(
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
      const data = await calendarEventTypesService.update(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id ?? '',
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await calendarEventTypesService.remove(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id ?? '',
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const calendarEventTypesController = new CalendarEventTypesController();
