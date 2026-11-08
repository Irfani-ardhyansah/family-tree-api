import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../shared/utils/response';
import { mcpTokenService } from '../auth/mcp-tokens/mcp-token.service';

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export class AdminMcpTokensController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await mcpTokenService.listFamily(
        req.auth!.familyId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await mcpTokenService.revokeByAdmin(
        req.auth!.familyId,
        req.auth!.personId,
        routeParam(req.params.id),
      );
      sendData(res, {
        revoked: true,
        item: data.item,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const adminMcpTokensController = new AdminMcpTokensController();
