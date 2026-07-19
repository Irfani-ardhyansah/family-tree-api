import { NextFunction, Request, Response } from 'express';
import { LogCategory, LogStatus } from '../../modules/logs/logs.types';
import { logsService } from '../../modules/logs/logs.service';

const SKIP_PATHS = new Set(['/api/v1/health', '/api/v1/logs/events']);

function shouldSkip(path: string): boolean {
  return SKIP_PATHS.has(path.replace(/\/+$/, ''));
}

function parseResource(path: string): { resourceType: string | null; resourceId: number | null } {
  const match = path.match(/\/api\/v1\/([^/]+)(?:\/(\d+))?/);
  if (!match) {
    return { resourceType: null, resourceId: null };
  }

  const resourceType = match[1] ?? null;
  const resourceId = match[2] ? Number(match[2]) : null;
  return { resourceType, resourceId: Number.isNaN(resourceId) ? null : resourceId };
}

export function httpAuditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith('/api/v1') || shouldSkip(req.path)) {
    next();
    return;
  }

  res.on('finish', () => {
    const action = logsService.inferAuditAction(req.method, req.path);
    if (!action) {
      return;
    }

    const category = action.startsWith('auth.') ? LogCategory.AUTH : LogCategory.AUDIT;
    const status = res.statusCode >= 400 ? LogStatus.FAILURE : LogStatus.SUCCESS;
    const { resourceType, resourceId } = parseResource(req.path);

    void logsService.recordFromRequest(req, {
      category,
      action,
      status,
      resourceType,
      resourceId,
      httpMethod: req.method,
      path: req.path,
      httpStatus: res.statusCode,
      message: `${req.method} ${req.path} → ${res.statusCode}`,
      metadata: {
        query: req.query,
      },
    });
  });

  next();
}
