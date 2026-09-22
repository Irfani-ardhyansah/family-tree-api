import { Knex } from 'knex';
import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import { mysqlDateTime } from './analytics-date';
import { EventRow, SessionRow } from './portfolio-analytics.types';

function isDup(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'ER_DUP_ENTRY'
  );
}

function json(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return JSON.stringify(value);
}

export type VisitorUpsert = {
  visitorId: string;
  seenAt: Date;
  countryCode: string | null;
  referrer: string | null;
  utm: unknown;
};

export type SessionUpsert = {
  sessionId: string;
  visitorId: string;
  at: Date;
  path: string;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  isBot: boolean;
  ip: string | null;
  ipHash: string | null;
  userAgent: string | null;
  incomplete: boolean;
  pageviewInc: number;
  clickInc: number;
  outboundInc: number;
  maxScroll: number;
  activeMs: number;
};

export type EventInsert = {
  eventId: string;
  visitorId: string | null;
  sessionId: string | null;
  name: string;
  ts: Date;
  receivedAt: Date;
  pageId: string | null;
  path: string | null;
  props: Record<string, unknown>;
  countryCode: string | null;
  isBot: boolean;
  incomplete: boolean;
};

export class CollectRepository {
  async insertEvent(trx: Knex.Transaction, row: EventInsert): Promise<boolean> {
    try {
      await trx(Tables.PA_EVENTS).insert({
        event_id: row.eventId,
        visitor_id: row.visitorId,
        session_id: row.sessionId,
        name: row.name,
        ts: mysqlDateTime(row.ts),
        received_at: mysqlDateTime(row.receivedAt),
        page_id: row.pageId,
        path: row.path,
        props: json(row.props),
        country_code: row.countryCode,
        is_bot: row.isBot,
        incomplete: row.incomplete,
      });
      return true;
    } catch (error) {
      if (isDup(error)) {
        return false;
      }
      throw error;
    }
  }

  async upsertVisitor(trx: Knex.Transaction, row: VisitorUpsert): Promise<void> {
    const seen = mysqlDateTime(row.seenAt);
    await trx.raw(
      `INSERT INTO ?? (visitor_id, first_seen_at, last_seen_at, first_country_code, last_country_code, first_referrer, first_utm_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         last_seen_at = VALUES(last_seen_at),
         last_country_code = COALESCE(VALUES(last_country_code), last_country_code)`,
      [
        Tables.PA_VISITORS,
        row.visitorId,
        seen,
        seen,
        row.countryCode,
        row.countryCode,
        row.referrer,
        json(row.utm),
      ],
    );
  }

  async upsertSession(trx: Knex.Transaction, row: SessionUpsert): Promise<void> {
    const at = mysqlDateTime(row.at);
    await trx.raw(
      `INSERT INTO ?? (
         session_id, visitor_id, started_at, ended_at, landing_path, exit_path, referrer,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         country_code, region, city, device, browser, os, is_bot, ip, ip_hash, user_agent,
         pageview_count, click_count, outbound_count, max_scroll_percent, active_ms, incomplete
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         ended_at = VALUES(ended_at),
         exit_path = VALUES(exit_path),
         is_bot = is_bot OR VALUES(is_bot),
         pageview_count = pageview_count + VALUES(pageview_count),
         click_count = click_count + VALUES(click_count),
         outbound_count = outbound_count + VALUES(outbound_count),
         max_scroll_percent = GREATEST(max_scroll_percent, VALUES(max_scroll_percent)),
         active_ms = GREATEST(active_ms, VALUES(active_ms))`,
      [
        Tables.PA_SESSIONS,
        row.sessionId,
        row.visitorId,
        at,
        at,
        row.path,
        row.path,
        row.referrer,
        row.utmSource,
        row.utmMedium,
        row.utmCampaign,
        row.utmContent,
        row.utmTerm,
        row.countryCode,
        row.region,
        row.city,
        row.device,
        row.browser,
        row.os,
        row.isBot,
        row.ip,
        row.ipHash,
        row.userAgent,
        row.pageviewInc,
        row.clickInc,
        row.outboundInc,
        row.maxScroll,
        row.activeMs,
        row.incomplete,
      ],
    );
  }

  async findSession(sessionId: string): Promise<SessionRow | undefined> {
    return db(Tables.PA_SESSIONS).where({ session_id: sessionId }).first<SessionRow>();
  }

  async listEventsForSession(sessionId: string): Promise<EventRow[]> {
    return db(Tables.PA_EVENTS)
      .where({ session_id: sessionId })
      .orderBy('ts', 'asc')
      .select<EventRow[]>('*');
  }
}

export const collectRepository = new CollectRepository();
