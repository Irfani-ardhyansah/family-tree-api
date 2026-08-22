import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { documentTypesService } from './document-types.service';

export class DocumentTypesController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentTypesService.list(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await documentTypesService.create(
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
      const data = await documentTypesService.update(
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
      const data = await documentTypesService.remove(
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

export const documentTypesController = new DocumentTypesController();
