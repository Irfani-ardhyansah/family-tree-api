import {
  AnalyticsEventName,
  AnalyticsPageId,
  OutboundChannel,
} from './portfolio-analytics.constants';

export type AnalyticsUtm = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
};

export type CollectEventInput = {
  event_id: string;
  name: string;
  ts: string;
  props?: Record<string, unknown> | null;
};

export type CollectBodyInput = {
  schema_version?: unknown;
  visitor_id?: unknown;
  session_id?: unknown;
  sent_at?: unknown;
  page?: {
    path?: unknown;
    title?: unknown;
    referrer?: unknown;
    utm?: Partial<Record<string, unknown>> | null;
  } | null;
  context?: unknown;
  events?: unknown;
};

export type SanitizedCollectEvent = {
  eventId: string;
  name: AnalyticsEventName;
  ts: Date;
  props: Record<string, unknown>;
  pageId: AnalyticsPageId | null;
  path: string;
  incomplete: boolean;
};

export type GeoLookup = {
  countryCode: string | null;
  countryName: string | null;
  region: string | null;
  city: string | null;
};

export type ParsedAnalyticsUa = {
  device: 'mobile' | 'desktop' | 'tablet' | 'unknown';
  os: string;
  browser: string;
  isBot: boolean;
};

export type SessionRow = {
  session_id: string;
  visitor_id: string;
  started_at: Date | string;
  ended_at: Date | string | null;
  landing_path: string | null;
  exit_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  country_code: string | null;
  region: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  is_bot: number | boolean;
  ip: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  pageview_count: number;
  click_count: number;
  outbound_count: number;
  max_scroll_percent: number;
  active_ms: number;
  incomplete: number | boolean;
};

export type EventRow = {
  event_id: string;
  visitor_id: string | null;
  session_id: string | null;
  name: string;
  ts: Date | string;
  received_at: Date | string;
  page_id: string | null;
  path: string | null;
  props: unknown;
  country_code: string | null;
  is_bot: number | boolean;
  incomplete: number | boolean;
};

export type ReportRange = {
  from: string;
  to: string;
  start: Date;
  end: Date;
  timezone: string;
  excludeBots: boolean;
  pageId: AnalyticsPageId | null;
};

export type OverviewResponse = {
  from: string;
  to: string;
  timezone: string;
  exclude_bots: boolean;
  page_id: AnalyticsPageId | null;
  unique_visitors: number;
  sessions: number;
  pageviews: number;
  bounce_rate: number;
  avg_active_ms: number;
  outbounds: Record<OutboundChannel, number>;
};

export type SessionListItem = {
  session_id: string;
  visitor_id: string;
  started_at: string;
  ended_at: string | null;
  landing_path: string | null;
  exit_path: string | null;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country_code: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  pageview_count: number;
  click_count: number;
  outbound_count: number;
  outbound_channels: OutboundChannel[];
  max_scroll_percent: number;
  active_ms: number;
  is_bot: boolean;
  incomplete: boolean;
};
