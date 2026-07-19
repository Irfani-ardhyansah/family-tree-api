import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { TrackNavigationInput } from './logs.types';
import { logsService } from './logs.service';

function isTrackNavigationInput(body: unknown): body is TrackNavigationInput {
  if (!body || typeof body !== 'object') {
    return false;
  }

  const value = body as TrackNavigationInput;
  return (
    (value.action === 'page.view' || value.action === 'click') &&
    typeof value.path === 'string' &&
    value.path.length > 0
  );
}

export class LogsController {
  async trackEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!isTrackNavigationInput(req.body)) {
        throw new AppError(400, ErrorCodes.INVALID_LOG_EVENT, 'Payload log tidak valid.');
      }

      await logsService.trackNavigation(req, req.body);
      sendData(res, { recorded: true }, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const logsController = new LogsController();
