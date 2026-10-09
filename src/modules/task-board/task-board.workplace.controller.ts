import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { taskBoardWorkplaceService } from './task-board.workplace.service';

export class TaskBoardWorkplaceController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardWorkplaceService.list(req.auth!.personId);
      sendData(res, { items: data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardWorkplaceService.create(
        req.auth!.personId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.update(
        req.auth!.personId,
        workplaceId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.archive(
        req.auth!.personId,
        workplaceId,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unarchive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.unarchive(
        req.auth!.personId,
        workplaceId,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      await taskBoardWorkplaceService.remove(req.auth!.personId, workplaceId);
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

export const taskBoardWorkplaceController =
  new TaskBoardWorkplaceController();
