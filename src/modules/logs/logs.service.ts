import { Request } from 'express';
import { env } from '../../config/env';
import { CreateAppLogInput, LogCategory, LogStatus, TrackNavigationInput } from './logs.types';
import { logsRepository } from './logs.repository';

function getClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
}

function requestContext(req: Request) {
  return {
    actorPersonId: req.auth?.personId ?? null,
    familyId: req.auth?.familyId ?? null,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'] ?? null,
    requestId: req.requestId ?? null,
  };
}

export class LogsService {
  async record(input: CreateAppLogInput): Promise<void> {
    try {
      await logsRepository.insert(input);
    } catch (error) {
      if (!env.isProduction) {
        console.error('[LogsService] failed to persist log', error);
      }
    }
  }

  async recordFromRequest(
    req: Request,
    input: Omit<CreateAppLogInput, 'ipAddress' | 'userAgent' | 'requestId'> & {
      actorPersonId?: number | null;
      familyId?: number | null;
    },
  ): Promise<void> {
    const ctx = requestContext(req);
    await this.record({
      ...input,
      actorPersonId: input.actorPersonId ?? ctx.actorPersonId,
      familyId: input.familyId ?? ctx.familyId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  async trackNavigation(req: Request, input: TrackNavigationInput): Promise<void> {
    const ctx = requestContext(req);
    const message =
      input.action === 'page.view'
        ? `Melihat halaman ${input.path}`
        : `Klik ${input.label ?? input.path}`;

    await this.record({
      category: LogCategory.NAVIGATION,
      action: input.action,
      status: LogStatus.SUCCESS,
      actorPersonId: ctx.actorPersonId,
      familyId: ctx.familyId,
      resourceType: 'page',
      path: input.path,
      message,
      metadata: {
        label: input.label ?? null,
        ...(input.metadata ?? {}),
      },
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }

  inferAuditAction(method: string, path: string): string | null {
    const normalized = path.replace(/^\/api\/v1/, '');

    if (normalized.startsWith('/persons')) {
      if (method === 'POST') return 'person.create';
      if (method === 'PUT' || method === 'PATCH') return 'person.update';
      if (method === 'DELETE') return 'person.delete';
      if (method === 'GET') return 'person.read';
    }

    if (normalized.startsWith('/auth/login') && method === 'POST') return 'auth.login';
    if (normalized.startsWith('/auth/logout') && method === 'POST') return 'auth.logout';
    if (normalized.startsWith('/auth/refresh') && method === 'POST') return 'auth.refresh';
    if (normalized.startsWith('/auth/me') && method === 'GET') return 'auth.me';

    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return null;
    }

    return `http.${method.toLowerCase()}`;
  }
}

export const logsService = new LogsService();
