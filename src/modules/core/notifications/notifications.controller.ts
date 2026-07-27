import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { notificationsService } from './notifications.service';

export class NotificationsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationsService.list(
        req.auth!.personId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationsService.unreadCount(req.auth!.personId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationsService.markRead(req.auth!.personId, req.params.id ?? '');
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await notificationsService.markAllRead(req.auth!.personId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const notificationsController = new NotificationsController();
