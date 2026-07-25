import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { mediaService } from './media.service';

function requireReadFocus(req: Request): NonNullable<Request['readFocus']> {
  if (!req.readFocus) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Read focus context belum di-resolve.');
  }
  return req.readFocus;
}

export class MediaController {
  async upload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireReadFocus(req);
      const data = await mediaService.upload({
        familyId: req.auth!.familyId,
        uploaderPersonId: req.auth!.personId,
        file: req.file,
        purposeRaw: req.body?.purpose,
        contextIdRaw: req.body?.contextId,
      });
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async deleteOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireReadFocus(req);
      const mediaId = String(req.params.mediaId ?? '');
      if (!mediaId.startsWith('med_')) {
        throw new AppError(400, ErrorCodes.MEDIA_VALIDATION_FAILED, 'mediaId tidak valid.');
      }
      await mediaService.deleteOne(req.auth!.personId, mediaId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async cleanup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      requireReadFocus(req);
      const data = await mediaService.cleanup(req.auth!.personId, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();
