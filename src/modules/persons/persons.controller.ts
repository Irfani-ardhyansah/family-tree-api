import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { personsService } from './persons.service';

function parsePersonId(raw: string): number {
  const personId = Number(raw);
  if (!Number.isInteger(personId) || personId <= 0) {
    throw new AppError(400, ErrorCodes.PERSON_VALIDATION_FAILED, 'ID person tidak valid.');
  }
  return personId;
}

function requireReadFocus(req: Request): NonNullable<Request['readFocus']> {
  if (!req.readFocus) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Read focus context belum di-resolve.');
  }
  return req.readFocus;
}

export class PersonsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await personsService.list(
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
      const personId = parsePersonId(req.params.id);
      const data = await personsService.getById(
        req.auth!.familyId,
        req.auth!.personId,
        personId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await personsService.create(req.auth!.familyId, req.auth!.personId, req.body);
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = parsePersonId(req.params.id);
      const data = await personsService.update(
        req.auth!.familyId,
        req.auth!.personId,
        personId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const personId = parsePersonId(req.params.id);
      await personsService.remove(req.auth!.familyId, req.auth!.personId, personId);
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

export const personsController = new PersonsController();
