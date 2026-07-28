import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { authService } from './auth.service';
import { secondaryPasswordService } from './secondary-password.service';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const remember = req.body?.remember === true;
      const result = await authService.login(req, req.body?.code, remember);
      sendData(res, result);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.me(req.auth!.personId);
      sendData(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.getOptions(req.auth!.personId);
      sendData(res, result);
    } catch (error) {
      next(error);
    }
  }

  async upsertOption(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.upsertOption(req.auth!.personId, req.body);
      sendData(res, result);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refresh(req, req.body?.refreshToken);
      sendData(res, result);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.logout(req, req.body?.refreshToken);
      sendData(res, { loggedOut: true });
    } catch (error) {
      next(error);
    }
  }

  async setupSecondaryPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await secondaryPasswordService.setup(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async verifySecondaryPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await secondaryPasswordService.verify(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async changeSecondaryPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await secondaryPasswordService.change(req.auth!.personId, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
