import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { documentsService } from './documents.service';

export class DocumentsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentsService.list(
        req.auth!.personId,
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentsService.getById(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id ?? '',
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentsService.create(
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
      const data = await documentsService.update(
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
      const data = await documentsService.remove(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id ?? '',
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async reminders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentsService.reminders(
        req.auth!.personId,
        req.auth!.familyId,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const documentsController = new DocumentsController();
