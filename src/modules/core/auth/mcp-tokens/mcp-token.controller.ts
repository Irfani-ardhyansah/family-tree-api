import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../../../shared/utils/response';
import { adminAuditService } from '../../admin/admin-audit.service';
import { mcpTokenService } from './mcp-token.service';

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

export class McpTokenController {
  async listOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await mcpTokenService.listOwn(req.auth!.personId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await mcpTokenService.create(
        req.auth!.personId,
        req.auth!.familyId,
        req.body,
        req.headers['x-module-unlock'],
      );

      await adminAuditService.record({
        familyId: req.auth!.familyId,
        actorPersonId: req.auth!.personId,
        moduleId: 'auth',
        action: 'create',
        summary: `Buat token MCP "${data.item.label}"`,
        after: {
          tokenId: data.item.id,
          label: data.item.label,
          unlocks: data.item.unlocks,
        },
      });

      res.setHeader('Cache-Control', 'no-store');
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async revokeOwn(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await mcpTokenService.revokeOwn(
        req.auth!.personId,
        routeParam(req.params.id),
      );

      if (!data.alreadyRevoked) {
        await adminAuditService.record({
          familyId: req.auth!.familyId,
          actorPersonId: req.auth!.personId,
          moduleId: 'auth',
          action: 'delete',
          summary: `Hapus token MCP "${data.item.label}"`,
          before: {
            tokenId: data.item.id,
            label: data.item.label,
            tokenHint: data.item.tokenHint,
          },
          after: { revoked: true },
        });
      }

      sendData(res, {
        revoked: true,
        item: data.item,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mcpTokenController = new McpTokenController();
