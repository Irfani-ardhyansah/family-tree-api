import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import {
  defaultReportRange,
  eachJakartaDate,
  isIsoDate,
  jakartaRangeToUtc,
  JAKARTA_TZ,
} from './analytics-date';
import { collectRepository } from './collect.repository';
import { countryName } from './geo-ip.service';
import { CLICK_LABELS } from './portfolio-analytics.constants';
import { ANALYTICS_PAGE_IDS, type AnalyticsPageId, type OutboundChannel } from './portfolio-analytics.constants';
import {
  EventRow,
  OverviewResponse,
  ReportRange,
  SessionListItem,
  SessionRow,
} from './portfolio-analytics.types';
import { reportingRepository } from './reporting.repository';

function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

function parseBool(value: unknown, fallback: boolean): boolean {
  const raw = queryString(value);
  if (raw === undefined) {
    return fallback;
  }
  if (raw === 'true' || raw === '1') {
    return true;
  }
  if (raw === 'false' || raw === '0') {
    return false;
  }
  return fallback;
}

function parsePage(query: Record<string, unknown>): { page: number; pageSize: number } {
  const page = Math.max(1, Number.parseInt(queryString(query.page) ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, Number.parseInt(queryString(query.pageSize) ?? '20', 10) || 20));
  return { page, pageSize };
}

export function parseReportRange(query: Record<string, unknown>): ReportRange {
  const defaults = defaultReportRange();
  const from = queryString(query.from) ?? defaults.from;
  const to = queryString(query.to) ?? defaults.to;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'Parameter from/to tidak valid (YYYY-MM-DD, from ≤ to).');
  }
  const pageRaw = queryString(query.page_id);
  let pageId: AnalyticsPageId | null = null;
  if (pageRaw) {
    if (!(ANALYTICS_PAGE_IDS as readonly string[]).includes(pageRaw)) {
      throw new AppError(422, ErrorCodes.VALIDATION_ERROR, 'page_id harus home atau work.');
    }
    pageId = pageRaw as AnalyticsPageId;
  }
  const { start, end } = jakartaRangeToUtc(from, to);
  return {
    from,
    to,
    start,
    end,
    timezone: JAKARTA_TZ,
    excludeBots: parseBool(query.exclude_bots, true),
    pageId,
  };
}

function asBool(value: number | boolean): boolean {
  return value === true || value === 1;
}

function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const normalized = String(value).replace(' ', 'T');
  const hasZone = /Z$|[+-]\d{2}:\d{2}$/.test(normalized);
  const parsed = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function parseProps(value: unknown): Record<string, unknown> {
  if (!value) {
    return {};
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function roundRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 100) / 100;
}

function fillDaily<T extends { date: string }>(
  from: string,
  to: string,
  rows: T[],
  empty: Omit<T, 'date'>,
): T[] {
  const byDate = new Map(rows.map((row) => [row.date, row]));
  return eachJakartaDate(from, to).map((date) => {
    const existing = byDate.get(date);
    if (existing) {
      return existing;
    }
    return { date, ...empty } as T;
  });
}

function toSessionItem(row: SessionRow, channels: OutboundChannel[]): SessionListItem {
  return {
    session_id: row.session_id,
    visitor_id: row.visitor_id,
    started_at: toIso(row.started_at) ?? '',
    ended_at: toIso(row.ended_at),
    landing_path: row.landing_path,
    exit_path: row.exit_path,
    referrer: row.referrer,
    utm_source: row.utm_source,
    utm_medium: row.utm_medium,
    utm_campaign: row.utm_campaign,
    country_code: row.country_code,
    city: row.city,
    device: row.device,
    browser: row.browser,
    os: row.os,
    pageview_count: Number(row.pageview_count),
    click_count: Number(row.click_count),
    outbound_count: Number(row.outbound_count),
    outbound_channels: channels,
    max_scroll_percent: Number(row.max_scroll_percent),
    active_ms: Number(row.active_ms),
    is_bot: asBool(row.is_bot),
    incomplete: asBool(row.incomplete),
  };
}

export class ReportingService {
  async overview(query: Record<string, unknown>): Promise<OverviewResponse> {
    const range = parseReportRange(query);
    const [uniqueVisitors, pageviews, sessionStats, outbounds] = await Promise.all([
      reportingRepository.countDistinctEventField(range, 'visitor_id'),
      reportingRepository.countEvents(range, ['page_view']),
      reportingRepository.sessionStats(range),
      reportingRepository.outboundTotals(range),
    ]);
    const bounceRate = sessionStats.sessions === 0 ? 0 : sessionStats.bounced / sessionStats.sessions;
    return {
      from: range.from,
      to: range.to,
      timezone: range.timezone,
      exclude_bots: range.excludeBots,
      page_id: range.pageId,
      unique_visitors: uniqueVisitors,
      sessions: sessionStats.sessions,
      pageviews,
      bounce_rate: roundRate(bounceRate),
      avg_active_ms: sessionStats.avgActiveMs,
      outbounds,
    };
  }

  async timeseries(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const buckets = await reportingRepository.timeseries(range);
    return {
      from: range.from,
      to: range.to,
      buckets: fillDaily(range.from, range.to, buckets, {
        unique_visitors: 0,
        pageviews: 0,
        sessions: 0,
      }),
    };
  }

  async geo(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const rows = await reportingRepository.geo(range);
    const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
    return {
      items: rows.map((row) => ({
        country_code: row.country_code,
        country_name: row.country_code ? countryName(row.country_code) : 'Unknown',
        count: row.count,
        percent: roundRate(row.count / total),
      })),
    };
  }

  async pages(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const [items, bounceByPath] = await Promise.all([
      reportingRepository.pages(range),
      reportingRepository.pageBounceAndActive(range),
    ]);
    return {
      items: items.map((item) => {
        const extra = bounceByPath.get(item.path ?? '');
        return {
          page_id: item.page_id,
          path: item.path,
          pageviews: item.pageviews,
          unique_visitors: item.unique_visitors,
          avg_active_ms: extra?.avgActiveMs ?? 0,
          bounce_rate: roundRate(extra?.bounceRate ?? 0),
        };
      }),
    };
  }

  async sections(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const items = await reportingRepository.sections(range);
    return { items };
  }

  async clicks(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const rows = await reportingRepository.clicks(range);
    const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
    return {
      items: rows.map((row) => ({
        element_id: row.element_id,
        element_type: row.element_type,
        label: row.label || (row.element_id ? CLICK_LABELS[row.element_id] ?? row.element_id : null),
        count: row.count,
        percent: roundRate(row.count / total),
      })),
    };
  }

  async outbounds(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const [totals, buckets] = await Promise.all([
      reportingRepository.outboundTotals(range),
      reportingRepository.outboundTimeseries(range),
    ]);
    return {
      totals,
      buckets: fillDaily(range.from, range.to, buckets, { email: 0, whatsapp: 0, instagram: 0 }),
    };
  }

  async referrers(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const { referrers, utm_sources } = await reportingRepository.referrers(range);
    const refTotal = referrers.reduce((sum, row) => sum + row.count, 0) || 1;
    const utmTotal = utm_sources.reduce((sum, row) => sum + row.count, 0) || 1;
    return {
      referrers: referrers.map((row) => ({
        referrer: row.referrer,
        count: row.count,
        percent: roundRate(row.count / refTotal),
      })),
      utm_sources: utm_sources.map((row) => ({
        source: row.source,
        count: row.count,
        percent: roundRate(row.count / utmTotal),
      })),
    };
  }

  async sessions(query: Record<string, unknown>) {
    const range = parseReportRange(query);
    const { page, pageSize } = parsePage(query);
    const { rows, total } = await reportingRepository.listSessions(range, page, pageSize);
    const channels = await reportingRepository.outboundChannelsForSessions(rows.map((row) => row.session_id));
    return {
      items: rows.map((row) => toSessionItem(row, channels.get(row.session_id) ?? [])),
      page,
      pageSize,
      total,
    };
  }

  async sessionById(id: string) {
    const session = await reportingRepository.findSession(id);
    if (!session) {
      throw new AppError(404, ErrorCodes.ANALYTICS_SESSION_NOT_FOUND, 'Session tidak ditemukan.');
    }
    const [events, channels] = await Promise.all([
      collectRepository.listEventsForSession(id),
      reportingRepository.outboundChannelsForSessions([id]),
    ]);
    return {
      session: toSessionItem(session, channels.get(id) ?? []),
      events: events.map((event) => mapEvent(event)),
    };
  }
}

function mapEvent(event: EventRow) {
  return {
    event_id: event.event_id,
    name: event.name,
    ts: toIso(event.ts),
    page_id: event.page_id,
    path: event.path,
    props: parseProps(event.props),
  };
}

export const reportingService = new ReportingService();
