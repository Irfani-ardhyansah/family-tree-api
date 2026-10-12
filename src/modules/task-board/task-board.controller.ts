import { NextFunction, Request, Response } from 'express';
import { sendData } from '../../shared/utils/response';
import { adminAuditService } from '../core/admin/admin-audit.service';
import { taskBoardService } from './task-board.service';

type TaskAuditAction = 'create' | 'update' | 'delete';

/** Catat aksi tulis Task Board ke Admin Audit Log (moduleId: task-board). */
async function recordTaskAudit(
  req: Request,
  input: {
    action: TaskAuditAction;
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

function requestedStatus(req: Request): unknown {
  if (!req.body || typeof req.body !== 'object') return undefined;
  return (req.body as Record<string, unknown>).status;
}

export class TaskBoardController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardService.list(
        req.auth!.personId,
        req.query as Record<string, unknown>,
      );
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.getById(req.auth!.personId, taskId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.getHistory(req.auth!.personId, taskId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async getRevisions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.getRevisions(req.auth!.personId, taskId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async reorder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardService.reorder(req.auth!.personId, req.body);
      await recordTaskAudit(req, {
        action: 'update',
        summary: `Urutkan ulang ${data.length} task`,
        after: { count: data.length },
      });
      sendData(res, { items: data });
    } catch (error) {
      next(error);
    }
  }

  async reorderDescriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.reorderDescriptions(
        req.auth!.personId,
        taskId,
        req.body,
      );
      await recordTaskAudit(req, {
        action: 'update',
        summary: `Urutkan ulang ${data.length} penjelasan (task #${taskId})`,
      });
      sendData(res, { items: data });
    } catch (error) {
      next(error);
    }
  }

  async reorderTodos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.reorderTodos(
        req.auth!.personId,
        taskId,
        req.body,
      );
      await recordTaskAudit(req, {
        action: 'update',
        summary: `Urutkan ulang ${data.length} todo (task #${taskId})`,
      });
      sendData(res, { items: data });
    } catch (error) {
      next(error);
    }
  }

  async listTodos(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.listTodos(req.auth!.personId, taskId);
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async createTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.createTodo(
        req.auth!.personId,
        taskId,
        req.body,
      );
      await recordTaskAudit(req, {
        action: 'create',
        summary: `Tambah todo "${data.title}" (task #${taskId})`,
        after: { id: data.id, taskId },
      });
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async updateTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const todoId = parseInt(req.params.todoId, 10);
      const data = await taskBoardService.updateTodo(
        req.auth!.personId,
        taskId,
        todoId,
        req.body,
      );
      await recordTaskAudit(req, {
        action: 'update',
        summary: `Ubah todo "${data.title}" (task #${taskId})`,
        after: { id: data.id, isDone: data.is_done },
      });
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async deleteTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const todoId = parseInt(req.params.todoId, 10);
      await taskBoardService.deleteTodo(req.auth!.personId, taskId, todoId);
      await recordTaskAudit(req, {
        action: 'delete',
        summary: `Hapus todo #${todoId} (task #${taskId})`,
      });
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await taskBoardService.create(req.auth!.personId, req.body);
      await recordTaskAudit(req, {
        action: 'create',
        summary: `Buat task "${data.title}"`,
        after: { id: data.id, title: data.title, status: data.status },
      });
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      const data = await taskBoardService.update(
        req.auth!.personId,
        taskId,
        req.body,
      );
      const statusChanged = requestedStatus(req) !== undefined;
      await recordTaskAudit(req, {
        action: 'update',
        summary: statusChanged
          ? `Ubah status task "${data.title}" → ${data.status}`
          : `Ubah task "${data.title}"`,
        after: { id: data.id, status: data.status },
      });
      sendData(res, data);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      await taskBoardService.delete(req.auth!.personId, taskId);
      await recordTaskAudit(req, {
        action: 'delete',
        summary: `Hapus task #${taskId}`,
      });
      // 200 + { deleted: true } — apiFetch FE tidak menangani body 204 (kosong).
      sendData(res, { deleted: true });
    } catch (error) {
      next(error);
    }
  }

  async uploadImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const taskId = parseInt(req.params.id, 10);
      if (!req.file) {
        throw new Error('No file uploaded');
      }
      const data = await taskBoardService.uploadImage(req.auth!.personId, taskId, req.file);
      sendData(res, data, 201);
    } catch (error) {
      next(error);
    }
  }
}

export const taskBoardController = new TaskBoardController();
