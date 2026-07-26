import { NextFunction, Request, Response } from 'express';
import { LogCategory, LogStatus } from '../../modules/core/logs/logs.types';
import { logsService } from '../../modules/core/logs/logs.service';

const SKIP_PATHS = new Set(['/api/v1/health', '/api/v1/logs/events']);

function getRequestPath(req: Request): string {
  return req.originalUrl.split('?')[0] ?? req.path;
}

function shouldSkip(path: string): boolean {
  return SKIP_PATHS.has(path.replace(/\/+$/, ''));
}

function parseResource(path: string): { resourceType: string | null; resourceId: number | null } {
  const memoriamMatch = path.match(/\/api\/v1\/memoriam\/(\d+)/);
  if (memoriamMatch) {
    return { resourceType: 'memorial', resourceId: Number(memoriamMatch[1]) };
  }

  if (path.includes('/api/v1/memoriam/deceased')) {
    return { resourceType: 'memorial', resourceId: null };
  }

  if (path.includes('/api/v1/persons/map')) {
    return { resourceType: 'person_map', resourceId: null };
  }

  const eventMatch = path.match(/\/api\/v1\/events\/(\d+)/);
  if (eventMatch) {
    return { resourceType: 'event', resourceId: Number(eventMatch[1]) };
  }

  if (path.includes('/api/v1/events')) {
    return { resourceType: 'event', resourceId: null };
  }

  const match = path.match(/\/api\/v1\/([^/]+)(?:\/(\d+))?/);
  if (!match) {
    return { resourceType: null, resourceId: null };
  }

  const resourceType = match[1] ?? null;
  const resourceId = match[2] ? Number(match[2]) : null;
  return { resourceType, resourceId: Number.isNaN(resourceId) ? null : resourceId };
}

export function httpAuditLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestPath = getRequestPath(req);

  if (!requestPath.startsWith('/api/v1') || shouldSkip(requestPath)) {
    next();
    return;
  }

  res.on('finish', () => {
    const action = logsService.inferAuditAction(req.method, requestPath);
    if (!action) {
      return;
    }

    const category = action.startsWith('auth.') ? LogCategory.AUTH : LogCategory.AUDIT;
    const status = res.statusCode >= 400 ? LogStatus.FAILURE : LogStatus.SUCCESS;
    const { resourceType, resourceId } = parseResource(requestPath);

    void logsService.recordFromRequest(req, {
      category,
      action,
      status,
      resourceType,
      resourceId,
      httpMethod: req.method,
      path: requestPath,
      httpStatus: res.statusCode,
      message: `${req.method} ${requestPath} → ${res.statusCode}`,
      metadata: {
        query: req.query,
      },
    });
  });

  next();
}
