import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { eventsService } from './events.service';

function parseEventId(raw: string): number {
  const eventId = Number(raw);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new AppError(400, ErrorCodes.EVENT_VALIDATION_FAILED, 'ID acara tidak valid.');
  }
  return eventId;
}

function requireReadFocus(req: Request): NonNullable<Request['readFocus']> {
  if (!req.readFocus) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Read focus context belum di-resolve.');
  }
  return req.readFocus;
}

export class EventsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await eventsService.list(
        req.auth!.familyId,
        req.auth!.personId,
        requireReadFocus(req),
        req.query,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = parseEventId(req.params.id);
      const data = await eventsService.getById(
        req.auth!.familyId,
        req.auth!.personId,
        eventId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await eventsService.create(
        req.auth!.familyId,
        req.auth!.personId,
        requireReadFocus(req),
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = parseEventId(req.params.id);
      const data = await eventsService.update(
        req.auth!.familyId,
        req.auth!.personId,
        eventId,
        requireReadFocus(req),
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = parseEventId(req.params.id);
      await eventsService.remove(req.auth!.familyId, eventId);
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async addContribution(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const eventId = parseEventId(req.params.id);
      const data = await eventsService.addContribution(
        req.auth!.familyId,
        req.auth!.personId,
        eventId,
        requireReadFocus(req),
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const eventsController = new EventsController();
