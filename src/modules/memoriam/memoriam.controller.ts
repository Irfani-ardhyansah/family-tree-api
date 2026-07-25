import { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import { sendData } from '../../shared/utils/response';
import { memoriamService } from './memoriam.service';

function parseDeceasedId(raw: string): number {
  const deceasedId = Number(raw);
  if (!Number.isInteger(deceasedId) || deceasedId <= 0) {
    throw new AppError(400, ErrorCodes.MEMORIAL_NOT_DECEASED, 'ID mendiang tidak valid.');
  }
  return deceasedId;
}

function parseTributeId(raw: string): number {
  const tributeId = Number(raw);
  if (!Number.isInteger(tributeId) || tributeId <= 0) {
    throw new AppError(400, ErrorCodes.TRIBUTE_VALIDATION_FAILED, 'ID tribute tidak valid.');
  }
  return tributeId;
}

function requireReadFocus(req: Request): NonNullable<Request['readFocus']> {
  if (!req.readFocus) {
    throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Read focus context belum di-resolve.');
  }
  return req.readFocus;
}

export class MemoriamController {
  async listDeceased(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await memoriamService.listDeceased(
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

  async getDeceasedById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const data = await memoriamService.getDeceasedById(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listTributes(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const data = await memoriamService.listTributes(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async createTribute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const data = await memoriamService.createTribute(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateTribute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const tributeId = parseTributeId(req.params.tributeId);
      const data = await memoriamService.updateTribute(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        tributeId,
        requireReadFocus(req),
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async removeTribute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const tributeId = parseTributeId(req.params.tributeId);
      await memoriamService.removeTribute(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        tributeId,
        requireReadFocus(req),
      );
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async listPrayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const data = await memoriamService.listPrayers(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async recordPrayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const { response, created } = await memoriamService.recordPrayer(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
      );
      sendData(res, response, created ? 201 : 200);
    } catch (error) {
      next(error);
    }
  }

  async getPrayerMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const deceasedId = parseDeceasedId(req.params.deceasedId);
      const data = await memoriamService.getPrayerMe(
        req.auth!.familyId,
        req.auth!.personId,
        deceasedId,
        requireReadFocus(req),
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const memoriamController = new MemoriamController();
