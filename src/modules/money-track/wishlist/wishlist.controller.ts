import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { wishlistService } from './wishlist.service';

export class WishlistController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(res, await wishlistService.list(req.auth!.personId, req.auth!.familyId));
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await wishlistService.create(req.auth!.personId, req.auth!.familyId, req.body),
        201,
      );
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await wishlistService.update(
          req.auth!.personId,
          req.auth!.familyId,
          req.params.id,
          req.body,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendData(
        res,
        await wishlistService.remove(req.auth!.personId, req.auth!.familyId, req.params.id),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const wishlistController = new WishlistController();
