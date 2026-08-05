import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { pocketsService } from './pockets.service';

export class PocketsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pocketsService.list(
        req.auth!.personId,
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pocketsService.create(
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
      const data = await pocketsService.update(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pocketsService.remove(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pocketsService.archive(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unarchive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await pocketsService.unarchive(
        req.auth!.personId,
        req.auth!.familyId,
        req.params.id,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const pocketsController = new PocketsController();
