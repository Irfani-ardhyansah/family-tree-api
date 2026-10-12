import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { adminAuditService } from '../core/admin/admin-audit.service';
import { taskBoardWorkplaceService } from './task-board.workplace.service';

type WorkplaceAuditAction = 'create' | 'update' | 'delete';

async function recordWorkplaceAudit(
  req: Request,
  input: {
    action: WorkplaceAuditAction;
    summary: string;
    after?: Record<string, unknown> | null;
  },
): Promise<void> {
  await adminAuditService.record({
    familyId: req.auth!.familyId,
    actorPersonId: req.auth!.personId,
    moduleId: 'task-board',
    action: input.action,
    summary: input.summary,
    after: input.after ?? null,
  });
}

export class TaskBoardWorkplaceController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardWorkplaceService.list(req.auth!.personId);
      sendData(res, { items: data });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardWorkplaceService.create(
        req.auth!.personId,
        req.body,
      );
      await recordWorkplaceAudit(req, {
        action: 'create',
        summary: `Buat tempat kerja "${data.name}"`,
        after: { id: data.id, name: data.name },
      });
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.update(
        req.auth!.personId,
        workplaceId,
        req.body,
      );
      await recordWorkplaceAudit(req, {
        action: 'update',
        summary: `Ubah tempat kerja "${data.name}"`,
        after: { id: data.id, name: data.name },
      });
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.archive(
        req.auth!.personId,
        workplaceId,
      );
      await recordWorkplaceAudit(req, {
        action: 'update',
        summary: `Arsipkan tempat kerja "${data.name}"`,
      });
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async unarchive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      const data = await taskBoardWorkplaceService.unarchive(
        req.auth!.personId,
        workplaceId,
      );
      await recordWorkplaceAudit(req, {
        action: 'update',
        summary: `Pulihkan tempat kerja "${data.name}"`,
      });
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const workplaceId = parseInt(req.params.id, 10);
      await taskBoardWorkplaceService.remove(req.auth!.personId, workplaceId);
      await recordWorkplaceAudit(req, {
        action: 'delete',
        summary: `Hapus tempat kerja #${workplaceId}`,
      });
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }
}

export const taskBoardWorkplaceController =
  new TaskBoardWorkplaceController();
