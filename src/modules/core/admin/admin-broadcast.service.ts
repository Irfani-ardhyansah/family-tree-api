import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { env } from '../../../config/env';
import { adminAuditService } from './admin-audit.service';
import { adminBroadcastRepository } from './admin-broadcast.repository';
import { toIso } from './admin.mapper';
import { pushService } from '../push/push.service';
import {
  AdminBroadcastItem,
  AdminBroadcastListResponse,
  AdminBroadcastTarget,
  AdminUsersResponse,
  BroadcastRow,
} from './admin.types';
import { sanitizeSimpleHtml } from './sanitize-html';

function parseTargetUserIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const ids: number[] = [];
  for (const item of raw) {
    if (typeof item === 'number' && Number.isInteger(item) && item > 0) {
      ids.push(item);
      continue;
    }
    if (typeof item === 'string' && /^\d+$/.test(item)) {
      ids.push(Number(item));
    }
  }
  return [...new Set(ids)];
}

function parseJsonIds(value: string | number[] | null): number[] {
  if (value == null) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

function targetLabel(target: AdminBroadcastTarget, count: number): string {
  if (target === 'all') {
    return 'Semua anggota';
  }
  return `${count} anggota terpilih`;
}

function toBroadcastItem(row: BroadcastRow): AdminBroadcastItem {
  const targetUserIds = parseJsonIds(row.target_user_ids);
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    target: row.target,
    targetUserIds,
    targetLabel: targetLabel(row.target, targetUserIds.length),
    scheduledAt: row.scheduled_at ? toIso(row.scheduled_at) : null,
    sentAt: row.sent_at ? toIso(row.sent_at) : null,
    status: row.status,
    createdAt: toIso(row.created_at),
  };
}

export class AdminBroadcastService {
  async listUsers(familyId: number): Promise<AdminUsersResponse> {
    const items = await adminBroadcastRepository.listUsersForBroadcast(familyId);
    return { items };
  }

  async list(familyId: number): Promise<AdminBroadcastListResponse> {
    await this.processDueScheduled();
    const rows = await adminBroadcastRepository.listByFamily(familyId);
    return { items: rows.map(toBroadcastItem) };
  }

  async create(
    familyId: number,
    personId: number,
    body: Record<string, unknown>,
  ): Promise<AdminBroadcastItem> {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const rawBody = typeof body.body === 'string' ? body.body : '';
    const target = body.target;
    const scheduledRaw = body.scheduledAt;

    if (!title) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'title wajib diisi.');
    }
    if (title.length > 255) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'title maksimal 255 karakter.');
    }
    if (typeof rawBody !== 'string' || !rawBody.trim()) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'body wajib diisi.');
    }
    if (target !== 'all' && target !== 'selected') {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'target harus all atau selected.');
    }

    let targetUserIds = parseTargetUserIds(body.targetUserIds);
    if (target === 'selected') {
      if (targetUserIds.length === 0) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'targetUserIds wajib diisi jika target=selected.',
        );
      }
      targetUserIds = await adminBroadcastRepository.filterAliveMemberIds(familyId, targetUserIds);
      if (targetUserIds.length === 0) {
        throw new AppError(
          422,
          ErrorCodes.VALIDATION_ERROR,
          'Tidak ada anggota valid di targetUserIds.',
        );
      }
    } else {
      targetUserIds = [];
    }

    let scheduledAt: Date | null = null;
    if (scheduledRaw !== undefined && scheduledRaw !== null && scheduledRaw !== '') {
      if (typeof scheduledRaw !== 'string') {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'scheduledAt harus ISO datetime.');
      }
      const parsed = new Date(scheduledRaw);
      if (Number.isNaN(parsed.getTime())) {
        throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'scheduledAt tidak valid.');
      }
      if (parsed.getTime() > Date.now() + 1000) {
        scheduledAt = parsed;
      }
    }

    const sanitizedBody = sanitizeSimpleHtml(rawBody);
    const sendNow = scheduledAt == null;

    const id = await adminBroadcastRepository.insert({
      familyId,
      createdByPersonId: personId,
      title,
      body: sanitizedBody,
      target,
      targetUserIds,
      scheduledAt,
      status: 'scheduled',
      sentAt: null,
    });

    if (sendNow) {
      await this.deliver(familyId, id);
    } else if (scheduledAt) {
      this.scheduleLocalDelivery(id, scheduledAt);
    }

    const row = await adminBroadcastRepository.findById(familyId, id);
    if (!row) {
      throw new AppError(500, ErrorCodes.INTERNAL_ERROR, 'Gagal membuat broadcast.');
    }

    await adminAuditService.record({
      familyId,
      actorPersonId: personId,
      moduleId: 'admin',
      action: 'broadcast',
      summary: sendNow ? `Broadcast dikirim: ${title}` : `Broadcast dijadwalkan: ${title}`,
      after: {
        id,
        target,
        scheduledAt: scheduledAt?.toISOString() ?? null,
        status: row.status,
      },
    });

    return toBroadcastItem(row);
  }

  private scheduleLocalDelivery(broadcastId: number, scheduledAt: Date): void {
    const delay = scheduledAt.getTime() - Date.now();
    if (delay > 24 * 60 * 60 * 1000) {
      return;
    }
    const wait = Math.max(delay, 0);
    setTimeout(() => {
      void this.processDueScheduled();
    }, wait);
  }

  async processDueScheduled(): Promise<void> {
    const due = await adminBroadcastRepository.findDueScheduled();
    for (const row of due) {
      try {
        await this.deliver(row.family_id, row.id);
      } catch (error) {
        if (!env.isProduction) {
          console.error('[AdminBroadcastService] deliver failed', row.id, error);
        }
        await adminBroadcastRepository.markFailed(
          row.id,
          error instanceof Error ? error.message : 'Gagal mengirim broadcast',
        );
      }
    }
  }

  private async deliver(familyId: number, broadcastId: number): Promise<void> {
    const row = await adminBroadcastRepository.findById(familyId, broadcastId);
    if (!row || row.status !== 'scheduled') {
      return;
    }

    const targetIds =
      row.target === 'all'
        ? await adminBroadcastRepository.listAliveMemberIds(familyId)
        : await adminBroadcastRepository.filterAliveMemberIds(
            familyId,
            parseJsonIds(row.target_user_ids),
          );

    await adminBroadcastRepository.insertNotifications(
      targetIds.map((personId) => ({
        familyId,
        personId,
        broadcastId,
        title: row.title,
        body: row.body,
      })),
    );

    await adminBroadcastRepository.markSent(broadcastId);

    void pushService.notifyBroadcast({
      personIds: targetIds,
      title: row.title,
      bodyHtml: row.body,
      broadcastId,
    });
  }
}

export const adminBroadcastService = new AdminBroadcastService();
