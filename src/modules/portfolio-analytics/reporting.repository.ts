import db from '../../config/database';
import { Tables } from '../../shared/database/tables';
import { mysqlDateTime } from './analytics-date';
import { AnalyticsPageId, OutboundChannel } from './portfolio-analytics.constants';
import { EventRow, ReportRange, SessionRow } from './portfolio-analytics.types';

function applyEventFilters(
  query: ReturnType<typeof db>,
  range: ReportRange,
  options?: { names?: string[] },
) {
  query.where('ts', '>=', mysqlDateTime(range.start)).andWhere('ts', '<=', mysqlDateTime(range.end));
  if (range.excludeBots) {
    query.andWhere('is_bot', false);
  }
  if (range.pageId) {
    query.andWhere('page_id', range.pageId);
  }
  if (options?.names?.length) {
    query.whereIn('name', options.names);
  }
  return query;
}

function applySessionFilters(query: ReturnType<typeof db>, range: ReportRange) {
  query
    .where('started_at', '>=', mysqlDateTime(range.start))
    .andWhere('started_at', '<=', mysqlDateTime(range.end));
  if (range.excludeBots) {
    query.andWhere('is_bot', false);
  }
  return query;
}

export class ReportingRepository {
  async countDistinctEventField(
    range: ReportRange,
    field: 'visitor_id' | 'session_id',
    names?: string[],
  ): Promise<number> {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names });
    const [row] = await query.countDistinct({ total: field });
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }

  async countEvents(range: ReportRange, names?: string[]): Promise<number> {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names });
    const [row] = await query.count({ total: '*' });
    return Number((row as { total?: number | string } | undefined)?.total ?? 0);
  }

  async sessionStats(range: ReportRange): Promise<{
    sessions: number;
    avgActiveMs: number;
    bounced: number;
  }> {
    const query = db(Tables.PA_SESSIONS);
    applySessionFilters(query, range);
    if (range.pageId) {
      query.whereExists(function existsPage() {
        this.select(db.raw('1'))
          .from(`${Tables.PA_EVENTS} as e`)
          .whereRaw('e.session_id = pa_sessions.session_id')
          .andWhere('e.page_id', range.pageId as AnalyticsPageId)
          .andWhere('e.ts', '>=', mysqlDateTime(range.start))
          .andWhere('e.ts', '<=', mysqlDateTime(range.end));
      });
    }

    const rows = await query.select<
      Array<{ sessions: number | string; avg_active: number | string | null; bounced: number | string }>
    >(
      db.raw('COUNT(*) as sessions'),
      db.raw('AVG(active_ms) as avg_active'),
      db.raw(
        `SUM(CASE WHEN pageview_count = 1 AND click_count = 0 AND active_ms < 10000 AND max_scroll_percent < 25 THEN 1 ELSE 0 END) as bounced`,
      ),
    );
    const row = rows[0];
    return {
      sessions: Number(row?.sessions ?? 0),
      avgActiveMs: Math.round(Number(row?.avg_active ?? 0)),
      bounced: Number(row?.bounced ?? 0),
    };
  }

  async outboundTotals(range: ReportRange): Promise<Record<OutboundChannel, number>> {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names: ['outbound_click'] });
    const rows = await query
      .select(db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel')) as channel`))
      .count({ total: '*' })
      .groupByRaw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel'))`);

    const totals: Record<OutboundChannel, number> = { email: 0, whatsapp: 0, instagram: 0 };
    for (const row of rows as Array<{ channel: string | null; total: number | string }>) {
      if (row.channel === 'email' || row.channel === 'whatsapp' || row.channel === 'instagram') {
        totals[row.channel] = Number(row.total);
      }
    }
    return totals;
  }

  async timeseries(range: ReportRange): Promise<
    Array<{ date: string; unique_visitors: number; pageviews: number; sessions: number }>
  > {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range);
    const rows = await query
      .select(
        db.raw(`DATE(ts + INTERVAL 7 HOUR) as bucket`),
        db.raw(`COUNT(DISTINCT visitor_id) as unique_visitors`),
        db.raw(`SUM(CASE WHEN name = 'page_view' THEN 1 ELSE 0 END) as pageviews`),
        db.raw(`COUNT(DISTINCT session_id) as sessions`),
      )
      .groupByRaw(`DATE(ts + INTERVAL 7 HOUR)`)
      .orderBy('bucket', 'asc');

    return (rows as Array<{ bucket: Date | string; unique_visitors: number | string; pageviews: number | string; sessions: number | string }>).
      map((row) => ({
        date: typeof row.bucket === 'string' ? row.bucket.slice(0, 10) : row.bucket.toISOString().slice(0, 10),
        unique_visitors: Number(row.unique_visitors),
        pageviews: Number(row.pageviews),
        sessions: Number(row.sessions),
      }));
  }

  async geo(range: ReportRange): Promise<Array<{ country_code: string | null; count: number }>> {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range);
    const rows = await query
      .select('country_code')
      .countDistinct({ count: 'visitor_id' })
      .groupBy('country_code')
      .orderBy('count', 'desc');
    return (rows as Array<{ country_code: string | null; count: number | string }>).map((row) => ({
      country_code: row.country_code,
      count: Number(row.count),
    }));
  }

  async pages(range: ReportRange): Promise<
    Array<{
      page_id: string | null;
      path: string | null;
      pageviews: number;
      unique_visitors: number;
    }>
  > {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names: ['page_view'] });
    const rows = await query
      .select('page_id', 'path')
      .count({ pageviews: '*' })
      .countDistinct({ unique_visitors: 'visitor_id' })
      .groupBy('page_id', 'path')
      .orderBy('pageviews', 'desc');
    return (
      rows as Array<{
        page_id: string | null;
        path: string | null;
        pageviews: number | string;
        unique_visitors: number | string;
      }>
    ).map((row) => ({
      page_id: row.page_id,
      path: row.path,
      pageviews: Number(row.pageviews),
      unique_visitors: Number(row.unique_visitors),
    }));
  }

  async sections(range: ReportRange): Promise<
    Array<{ page_id: string | null; section_id: string | null; views: number; unique_sessions: number }>
  > {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names: ['section_view'] });
    const rows = await query
      .select('page_id', db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.section_id')) as section_id`))
      .count({ views: '*' })
      .countDistinct({ unique_sessions: 'session_id' })
      .groupByRaw(`page_id, JSON_UNQUOTE(JSON_EXTRACT(props, '$.section_id'))`)
      .orderBy('views', 'desc');
    return (
      rows as Array<{
        page_id: string | null;
        section_id: string | null;
        views: number | string;
        unique_sessions: number | string;
      }>
    ).map((row) => ({
      page_id: row.page_id,
      section_id: row.section_id,
      views: Number(row.views),
      unique_sessions: Number(row.unique_sessions),
    }));
  }

  async clicks(range: ReportRange): Promise<
    Array<{ element_id: string | null; element_type: string | null; label: string | null; count: number }>
  > {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names: ['click', 'work_card_view'] });
    const rows = await query
      .select(
        db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.element_id')) as element_id`),
        db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.element_type')) as element_type`),
        db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.label')) as label`),
      )
      .count({ count: '*' })
      .groupByRaw(
        `JSON_UNQUOTE(JSON_EXTRACT(props, '$.element_id')), JSON_UNQUOTE(JSON_EXTRACT(props, '$.element_type')), JSON_UNQUOTE(JSON_EXTRACT(props, '$.label'))`,
      )
      .orderBy('count', 'desc')
      .limit(50);
    return (
      rows as Array<{
        element_id: string | null;
        element_type: string | null;
        label: string | null;
        count: number | string;
      }>
    ).map((row) => ({
      element_id: row.element_id,
      element_type: row.element_type,
      label: row.label,
      count: Number(row.count),
    }));
  }

  async outboundTimeseries(range: ReportRange): Promise<
    Array<{ date: string; email: number; whatsapp: number; instagram: number }>
  > {
    const query = db(Tables.PA_EVENTS);
    applyEventFilters(query, range, { names: ['outbound_click'] });
    const rows = await query
      .select(
        db.raw(`DATE(ts + INTERVAL 7 HOUR) as bucket`),
        db.raw(
          `SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel')) = 'email' THEN 1 ELSE 0 END) as email`,
        ),
        db.raw(
          `SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel')) = 'whatsapp' THEN 1 ELSE 0 END) as whatsapp`,
        ),
        db.raw(
          `SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel')) = 'instagram' THEN 1 ELSE 0 END) as instagram`,
        ),
      )
      .groupByRaw(`DATE(ts + INTERVAL 7 HOUR)`)
      .orderBy('bucket', 'asc');
    return (
      rows as Array<{
        bucket: Date | string;
        email: number | string;
        whatsapp: number | string;
        instagram: number | string;
      }>
    ).map((row) => ({
      date: typeof row.bucket === 'string' ? row.bucket.slice(0, 10) : row.bucket.toISOString().slice(0, 10),
      email: Number(row.email),
      whatsapp: Number(row.whatsapp),
      instagram: Number(row.instagram),
    }));
  }

  async referrers(range: ReportRange): Promise<{
    referrers: Array<{ referrer: string | null; count: number }>;
    utm_sources: Array<{ source: string | null; count: number }>;
  }> {
    const sessionQuery = db(Tables.PA_SESSIONS);
    applySessionFilters(sessionQuery, range);
    const referrerRows = await sessionQuery
      .clone()
      .select('referrer')
      .count({ count: '*' })
      .groupBy('referrer')
      .orderBy('count', 'desc')
      .limit(50);
    const utmRows = await sessionQuery
      .clone()
      .select('utm_source')
      .count({ count: '*' })
      .groupBy('utm_source')
      .orderBy('count', 'desc')
      .limit(50);

    return {
      referrers: (referrerRows as Array<{ referrer: string | null; count: number | string }>).map((row) => ({
        referrer: row.referrer,
        count: Number(row.count),
      })),
      utm_sources: (utmRows as Array<{ utm_source: string | null; count: number | string }>).map((row) => ({
        source: row.utm_source,
        count: Number(row.count),
      })),
    };
  }

  async listSessions(
    range: ReportRange,
    page: number,
    pageSize: number,
  ): Promise<{ rows: SessionRow[]; total: number }> {
    const query = db(Tables.PA_SESSIONS);
    applySessionFilters(query, range);
    if (range.pageId) {
      query.whereExists(function existsPage() {
        this.select(db.raw('1'))
          .from(`${Tables.PA_EVENTS} as e`)
          .whereRaw('e.session_id = pa_sessions.session_id')
          .andWhere('e.page_id', range.pageId as string);
      });
    }

    const countQuery = query.clone().clearSelect().clearOrder().count({ total: '*' });
    const [countRow] = await countQuery;
    const total = Number((countRow as { total?: number | string } | undefined)?.total ?? 0);

    const rows = await query
      .select<SessionRow[]>('*')
      .orderBy('started_at', 'desc')
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { rows, total };
  }

  async outboundChannelsForSessions(sessionIds: string[]): Promise<Map<string, OutboundChannel[]>> {
    const map = new Map<string, OutboundChannel[]>();
    if (sessionIds.length === 0) {
      return map;
    }
    const rows = await db(Tables.PA_EVENTS)
      .whereIn('session_id', sessionIds)
      .andWhere('name', 'outbound_click')
      .select('session_id', db.raw(`JSON_UNQUOTE(JSON_EXTRACT(props, '$.channel')) as channel`));

    for (const row of rows as Array<{ session_id: string; channel: string | null }>) {
      if (row.channel === 'email' || row.channel === 'whatsapp' || row.channel === 'instagram') {
        const list = map.get(row.session_id) ?? [];
        if (!list.includes(row.channel)) {
          list.push(row.channel);
        }
        map.set(row.session_id, list);
      }
    }
    return map;
  }

  async findSession(sessionId: string): Promise<SessionRow | undefined> {
    return db(Tables.PA_SESSIONS).where({ session_id: sessionId }).first<SessionRow>();
  }

  async listSessionEvents(sessionId: string): Promise<EventRow[]> {
    return db(Tables.PA_EVENTS)
      .where({ session_id: sessionId })
      .orderBy('ts', 'asc')
      .select<EventRow[]>('*');
  }

  async pageBounceAndActive(
    range: ReportRange,
  ): Promise<Map<string, { bounceRate: number; avgActiveMs: number }>> {
    const query = db(Tables.PA_SESSIONS);
    applySessionFilters(query, range);
    const rows = await query
      .select('landing_path')
      .select(
        db.raw('AVG(active_ms) as avg_active'),
        db.raw(
          `AVG(CASE WHEN pageview_count = 1 AND click_count = 0 AND active_ms < 10000 AND max_scroll_percent < 25 THEN 1 ELSE 0 END) as bounce_rate`,
        ),
      )
      .groupBy('landing_path');

    const map = new Map<string, { bounceRate: number; avgActiveMs: number }>();
    for (const row of rows as Array<{
      landing_path: string | null;
      avg_active: number | string | null;
      bounce_rate: number | string | null;
    }>) {
      map.set(row.landing_path ?? '', {
        bounceRate: Number(row.bounce_rate ?? 0),
        avgActiveMs: Math.round(Number(row.avg_active ?? 0)),
      });
    }
    return map;
  }

  async upsertDailyRollup(row: {
    bucketDate: string;
    pageId: string;
    uniqueVisitors: number;
    sessions: number;
    pageviews: number;
    outboundEmail: number;
    outboundWhatsapp: number;
    outboundInstagram: number;
    topCountries: unknown;
    avgActiveMs: number;
  }): Promise<void> {
    await db.raw(
      `INSERT INTO ?? (
         bucket_date, page_id, unique_visitors, sessions, pageviews,
         outbound_email, outbound_whatsapp, outbound_instagram, top_countries, avg_active_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         unique_visitors = VALUES(unique_visitors),
         sessions = VALUES(sessions),
         pageviews = VALUES(pageviews),
         outbound_email = VALUES(outbound_email),
         outbound_whatsapp = VALUES(outbound_whatsapp),
         outbound_instagram = VALUES(outbound_instagram),
         top_countries = VALUES(top_countries),
         avg_active_ms = VALUES(avg_active_ms)`,
      [
        Tables.PA_DAILY_ROLLUPS,
        row.bucketDate,
        row.pageId,
        row.uniqueVisitors,
        row.sessions,
        row.pageviews,
        row.outboundEmail,
        row.outboundWhatsapp,
        row.outboundInstagram,
        JSON.stringify(row.topCountries),
        row.avgActiveMs,
      ],
    );
  }

  async hashOldIps(cutoff: Date): Promise<number> {
    return db(Tables.PA_SESSIONS)
      .whereNotNull('ip')
      .andWhere('started_at', '<', mysqlDateTime(cutoff))
      .update({ ip: null });
  }

  async deleteOldEvents(cutoff: Date): Promise<number> {
    return db(Tables.PA_EVENTS).where('ts', '<', mysqlDateTime(cutoff)).del();
  }

  async deleteOldRollups(cutoffDate: string): Promise<number> {
    return db(Tables.PA_DAILY_ROLLUPS).where('bucket_date', '<', cutoffDate).del();
  }
}

export const reportingRepository = new ReportingRepository();
