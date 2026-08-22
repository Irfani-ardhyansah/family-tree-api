import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { membersService } from './members.service';

export class MembersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await membersService.list(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const membersController = new MembersController();
