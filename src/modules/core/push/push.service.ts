import webpush from 'web-push';
import { env } from '../../../config/env';
import { AppError } from '../../../shared/errors/AppError';
import { ErrorCodes } from '../../../shared/errors/errorCodes';
import { pushRepository } from './push.repository';
import { stripHtml, truncate } from './push.text';
import {
  PushPayload,
  PushSubscriptionRow,
  UpsertPushSubscriptionInput,
  VapidPublicKeyResponse,
} from './push.types';

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) {
    return true;
  }
  const { publicKey, privateKey, subject } = env.webPush;
  if (!publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

function isGoneError(error: unknown): boolean {
  const statusCode =
    error && typeof error === 'object' && 'statusCode' in error
      ? Number((error as { statusCode?: number }).statusCode)
      : null;
  return statusCode === 404 || statusCode === 410;
}

export class PushService {
  getVapidPublicKey(): VapidPublicKeyResponse {
    const publicKey = env.webPush.publicKey;
    return {
      publicKey,
      configured: Boolean(publicKey && env.webPush.privateKey),
    };
  }

  isEnabled(): boolean {
    return ensureVapid();
  }

  async subscribe(
    personId: number,
    familyId: number,
    body: unknown,
    userAgentHeader?: string | null,
  ): Promise<{ id: number; endpoint: string }> {
    if (!ensureVapid()) {
      throw new AppError(
        503,
        ErrorCodes.PUSH_NOT_CONFIGURED,
        'Web Push belum dikonfigurasi (VAPID keys).',
      );
    }

    const input = this.parseSubscriptionBody(body);
    const userAgent =
      typeof (body as UpsertPushSubscriptionInput).userAgent === 'string'
        ? (body as UpsertPushSubscriptionInput).userAgent
        : userAgentHeader ?? null;

    const row = await pushRepository.upsert({
      personId,
      familyId,
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      userAgent: userAgent?.slice(0, 512) ?? null,
    });

    return { id: row.id, endpoint: row.endpoint };
  }

  async unsubscribe(personId: number, body: unknown): Promise<{ removed: boolean }> {
    const endpoint =
      body && typeof body === 'object' && typeof (body as { endpoint?: unknown }).endpoint === 'string'
        ? (body as { endpoint: string }).endpoint.trim()
        : '';

    if (!endpoint) {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'endpoint wajib diisi.',
      );
    }

    const removed = await pushRepository.deleteByEndpointForPerson(personId, endpoint);
    return { removed: removed > 0 };
  }

  /**
   * Fire-and-forget safe: errors logged, stale subs cleaned.
   * No-op jika VAPID belum di-set.
   */
  async notifyPersons(
    personIds: number[],
    payload: PushPayload,
  ): Promise<{ sent: number; removed: number }> {
    if (!ensureVapid() || personIds.length === 0) {
      return { sent: 0, removed: 0 };
    }

    const uniqueIds = [...new Set(personIds)];
    const subs = await pushRepository.listByPersonIds(uniqueIds);
    let sent = 0;
    let removed = 0;

    await Promise.all(
      subs.map(async (sub) => {
        const result = await this.sendOne(sub, payload);
        if (result === 'sent') sent += 1;
        if (result === 'removed') removed += 1;
      }),
    );

    return { sent, removed };
  }

  async notifyBroadcast(input: {
    personIds: number[];
    title: string;
    bodyHtml: string;
    broadcastId: number;
  }): Promise<void> {
    const plain = truncate(stripHtml(input.bodyHtml) || input.title);
    try {
      await this.notifyPersons(input.personIds, {
        title: input.title,
        body: plain,
        data: {
          url: '/inbox',
          type: 'broadcast',
          broadcastId: input.broadcastId,
        },
      });
    } catch (error) {
      if (!env.isProduction) {
        console.error('[PushService] notifyBroadcast failed', error);
      }
    }
  }

  private async sendOne(
    sub: PushSubscriptionRow,
    payload: PushPayload,
  ): Promise<'sent' | 'removed' | 'failed'> {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload),
        {
          TTL: 60 * 60,
          urgency: 'normal',
        },
      );
      return 'sent';
    } catch (error) {
      if (isGoneError(error)) {
        await pushRepository.deleteById(sub.id);
        return 'removed';
      }
      if (!env.isProduction) {
        console.error('[PushService] send failed', sub.id, error);
      }
      return 'failed';
    }
  }

  private parseSubscriptionBody(body: unknown): UpsertPushSubscriptionInput {
    if (!body || typeof body !== 'object') {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'Body subscription tidak valid.',
      );
    }

    const record = body as Record<string, unknown>;
    const endpoint = typeof record.endpoint === 'string' ? record.endpoint.trim() : '';
    const keys = record.keys;

    if (!endpoint || !endpoint.startsWith('http')) {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'endpoint tidak valid.',
      );
    }
    if (endpoint.length > 2048) {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'endpoint terlalu panjang.',
      );
    }
    if (!keys || typeof keys !== 'object') {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'keys.p256dh dan keys.auth wajib.',
      );
    }

    const keyRecord = keys as Record<string, unknown>;
    const p256dh = typeof keyRecord.p256dh === 'string' ? keyRecord.p256dh.trim() : '';
    const auth = typeof keyRecord.auth === 'string' ? keyRecord.auth.trim() : '';

    if (!p256dh || !auth) {
      throw new AppError(
        422,
        ErrorCodes.PUSH_SUBSCRIPTION_INVALID,
        'keys.p256dh dan keys.auth wajib.',
      );
    }

    return {
      endpoint,
      keys: { p256dh, auth },
    };
  }
}

export const pushService = new PushService();
