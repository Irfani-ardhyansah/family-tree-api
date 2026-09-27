import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { taskBoardService } from './task-board.service';

export class TaskBoardController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardService.list(
        req.auth!.personId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.getById(req.auth!.personId, taskId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardService.create(req.auth!.personId, req.body);
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.update(req.auth!.personId, taskId, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      await taskBoardService.delete(req.auth!.personId, taskId);
      // 200 + { deleted: true } — apiFetch FE tidak menangani body 204 (kosong).
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      const data = await taskBoardService.uploadImage(req.auth!.personId, taskId, req.file);
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const taskBoardController = new TaskBoardController();
