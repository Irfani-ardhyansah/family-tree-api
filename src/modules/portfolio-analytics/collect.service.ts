import { Request } from 'express';
import db from '../../config/database';
import { getClientIp } from '../../shared/utils/client-ip';
import { hashIp } from './analytics-crypto';
import { parseCollectBody } from './collect.parser';
import { collectRepository } from './collect.repository';
import { lookupGeo } from './geo-ip.service';
import { parseAnalyticsUserAgent } from './parse-analytics-ua';
import { CollectBodyInput, SanitizedCollectEvent } from './portfolio-analytics.types';

function headerCountry(req: Request): string | null {
  const cf = req.headers['cf-ipcountry'];
  if (typeof cf === 'string' && cf.trim()) {
    return cf.trim();
  }
  return null;
}

function increments(event: SanitizedCollectEvent): {
  pageviewInc: number;
  clickInc: number;
  outboundInc: number;
  maxScroll: number;
  activeMs: number;
} {
  return {
    pageviewInc: event.name === 'page_view' ? 1 : 0,
    clickInc: event.name === 'click' || event.name === 'work_card_view' ? 1 : 0,
    outboundInc: event.name === 'outbound_click' ? 1 : 0,
    maxScroll: event.name === 'scroll_depth' ? Number(event.props.percent) || 0 : 0,
    activeMs: event.name === 'engagement_heartbeat' ? Number(event.props.active_ms) || 0 : 0,
  };
}

export class CollectService {
  async collect(req: Request): Promise<{ accepted: number; duplicate_event_ids: string[] }> {
    const batch = parseCollectBody((req.body ?? {}) as CollectBodyInput);
    const receivedAt = new Date();
    const ip = getClientIp(req);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 512) : null;
    const ua = parseAnalyticsUserAgent(userAgent);
    const geo = await lookupGeo(ip, headerCountry(req));
    const isBot = ua.isBot || req.analyticsForceBot === true;
    const ipHash = ip ? hashIp(ip) : null;

    const duplicateEventIds: string[] = [];
    let accepted = 0;

    await db.transaction(async (trx) => {
      for (const event of batch.events) {
        const inserted = await collectRepository.insertEvent(trx, {
          eventId: event.eventId,
          visitorId: batch.visitorId,
          sessionId: batch.sessionId,
          name: event.name,
          ts: event.ts,
          receivedAt,
          pageId: event.pageId,
          path: event.path,
          props: event.props,
          countryCode: geo.countryCode,
          isBot,
          incomplete: event.incomplete,
        });

        if (!inserted) {
          duplicateEventIds.push(event.eventId);
          continue;
        }

        accepted += 1;
        const inc = increments(event);

        if (batch.visitorId) {
          await collectRepository.upsertVisitor(trx, {
            visitorId: batch.visitorId,
            seenAt: event.ts,
            countryCode: geo.countryCode,
            referrer: batch.referrer,
            utm: batch.utm,
          });
        }

        if (batch.visitorId && batch.sessionId) {
          await collectRepository.upsertSession(trx, {
            sessionId: batch.sessionId,
            visitorId: batch.visitorId,
            at: event.ts,
            path: event.path,
            referrer: batch.referrer,
            utmSource: batch.utm.source,
            utmMedium: batch.utm.medium,
            utmCampaign: batch.utm.campaign,
            utmContent: batch.utm.content,
            utmTerm: batch.utm.term,
            countryCode: geo.countryCode,
            region: geo.region,
            city: geo.city,
            device: ua.device,
            browser: ua.browser,
            os: ua.os,
            isBot,
            ip,
            ipHash,
            userAgent,
            incomplete: batch.incomplete,
            ...inc,
          });
        }
      }
    });

    return { accepted, duplicate_event_ids: duplicateEventIds };
  }
}

export const collectService = new CollectService();
