import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { authService } from './auth.service';

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

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.refresh(req.body?.refreshToken);
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
}

export const authController = new AuthController();
