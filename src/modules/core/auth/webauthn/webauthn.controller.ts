import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../../shared/utils/response';
import { parseCredentialIdParam } from './webauthn.parser';
import { webauthnService } from './webauthn.service';

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

export class WebauthnController {
  async loginOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.loginOptions();
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async loginVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.loginVerify(req, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async registerOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.registerOptions(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async registerVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.registerVerify(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.listOwn(req.auth!.personId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseCredentialIdParam(routeParam(req.params.id));
      const data = await webauthnService.updateOwnLabel(req.auth!.personId, id, req.body);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async deleteOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseCredentialIdParam(routeParam(req.params.id));
      const data = await webauthnService.deleteOwn(req.auth!.personId, id);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unlockOptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.unlockOptions(req.auth!.personId, req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unlockVerify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.unlockVerify(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async listFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await webauthnService.listFamily(req.auth!.familyId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async updateFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseCredentialIdParam(routeParam(req.params.id));
      const data = await webauthnService.updateFamily(
        req.auth!.familyId,
        req.auth!.personId,
        id,
        req.body,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async deleteFamily(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseCredentialIdParam(routeParam(req.params.id));
      const data = await webauthnService.deleteFamily(req.auth!.familyId, req.auth!.personId, id);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }
}

export const webauthnController = new WebauthnController();
