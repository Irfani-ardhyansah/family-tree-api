import { env } from '../../config/env';
import { AppError } from '../../shared/errors/AppError';
import { ErrorCodes } from '../../shared/errors/errorCodes';
import {
  ANALYTICS_EVENT_NAMES,
  ANALYTICS_PAGE_IDS,
  CLICK_ELEMENT_IDS,
  OUTBOUND_CHANNELS,
  SCROLL_PERCENTS,
  SECTION_IDS,
  type AnalyticsEventName,
  type AnalyticsPageId,
} from './portfolio-analytics.constants';
import {
  CollectBodyInput,
  CollectEventInput,
  SanitizedCollectEvent,
  AnalyticsUtm,
} from './portfolio-analytics.types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ULID_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
const EVENT_NAMES = new Set<string>(ANALYTICS_EVENT_NAMES);
const PAGE_IDS = new Set<string>(ANALYTICS_PAGE_IDS);
const ELEMENT_IDS = new Set<string>(CLICK_ELEMENT_IDS);
const SECTION_ID_SET = new Set<string>(SECTION_IDS);
const SCROLL_SET = new Set<number>(SCROLL_PERCENTS);
const CHANNEL_SET = new Set<string>(OUTBOUND_CHANNELS);

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isEventId(value: string): boolean {
  return UUID_RE.test(value) || ULID_RE.test(value);
}

export function normalizeAnalyticsPath(path: string): string {
  let p = path.trim();
  try {
    if (/^https?:\/\//i.test(p)) {
      p = new URL(p).pathname;
    }
  } catch {
    // keep raw
  }
  p = p.split('?')[0]?.split('#')[0] ?? '/';
  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  return p;
}

export function isAllowedAnalyticsPath(path: string): boolean {
  const n = normalizeAnalyticsPath(path);
  const allowed = env.analytics.allowedPaths;
  if (allowed.includes(n)) {
    return true;
  }
  const alt = n.endsWith('/') ? n.slice(0, -1) || '/' : `${n}/`;
  return allowed.includes(alt);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function parseUtm(raw: unknown): AnalyticsUtm {
  const rec = asRecord(raw);
  return {
    source: asString(rec.source),
    medium: asString(rec.medium),
    campaign: asString(rec.campaign),
    content: asString(rec.content),
    term: asString(rec.term),
  };
}

function parseTs(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function parsePageId(value: unknown, path: string): AnalyticsPageId | null {
  if (typeof value === 'string' && PAGE_IDS.has(value)) {
    return value as AnalyticsPageId;
  }
  const n = normalizeAnalyticsPath(path);
  if (n.includes('/work')) {
    return 'work';
  }
  if (n === '/' || n === '/portfolio' || n === '/portfolio/') {
    return 'home';
  }
  return null;
}

function sanitizeProps(name: AnalyticsEventName, props: Record<string, unknown>): Record<string, unknown> | null {
  if (name === 'click' || name === 'work_card_view') {
    if (name === 'click') {
      const elementId = asString(props.element_id);
      const workSlug = asString(props.work_slug);
      if ((!elementId || !ELEMENT_IDS.has(elementId)) && !workSlug) {
        return null;
      }
    }
    return props;
  }
  if (name === 'section_view') {
    const sectionId = asString(props.section_id);
    if (!sectionId || !SECTION_ID_SET.has(sectionId)) {
      return null;
    }
    return props;
  }
  if (name === 'scroll_depth') {
    const percent = Number(props.percent);
    if (!SCROLL_SET.has(percent)) {
      return null;
    }
    return { percent };
  }
  if (name === 'outbound_click') {
    const channel = asString(props.channel);
    if (!channel || !CHANNEL_SET.has(channel)) {
      return null;
    }
    return props;
  }
  if (name === 'engagement_heartbeat') {
    const activeMs = Number(props.active_ms);
    if (!Number.isFinite(activeMs) || activeMs < 0) {
      return { ...props, active_ms: 0 };
    }
    return { ...props, active_ms: Math.min(Math.round(activeMs), 20 * 60 * 1000) };
  }
  return props;
}

export function sanitizeCollectEvent(
  raw: CollectEventInput,
  pagePath: string,
  pageIdHint: AnalyticsPageId | null,
  incomplete: boolean,
): SanitizedCollectEvent | null {
  if (!isEventId(raw.event_id) || !EVENT_NAMES.has(raw.name)) {
    return null;
  }
  const ts = parseTs(raw.ts);
  if (!ts) {
    return null;
  }
  const name = raw.name as AnalyticsEventName;
  const props = sanitizeProps(name, asRecord(raw.props));
  if (!props) {
    return null;
  }
  const path = pagePath;
  if (!isAllowedAnalyticsPath(path)) {
    return null;
  }
  if (incomplete && name !== 'page_view') {
    return null;
  }
  const pageId = parsePageId(props.page_id ?? pageIdHint, path);
  return {
    eventId: raw.event_id,
    name,
    ts,
    props,
    pageId,
    path: normalizeAnalyticsPath(path),
    incomplete,
  };
}

export type ParsedCollectBatch = {
  visitorId: string | null;
  sessionId: string | null;
  incomplete: boolean;
  path: string;
  title: string | null;
  referrer: string | null;
  utm: AnalyticsUtm;
  events: SanitizedCollectEvent[];
};

export function parseCollectBody(body: CollectBodyInput): ParsedCollectBatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, ErrorCodes.ANALYTICS_INVALID_PAYLOAD, 'Payload analytics tidak valid.');
  }
  if (body.schema_version !== 1) {
    throw new AppError(400, ErrorCodes.ANALYTICS_INVALID_PAYLOAD, 'schema_version harus 1.');
  }
  if (!Array.isArray(body.events)) {
    throw new AppError(400, ErrorCodes.ANALYTICS_INVALID_PAYLOAD, 'events harus berupa array.');
  }
  if (body.events.length === 0) {
    throw new AppError(400, ErrorCodes.ANALYTICS_INVALID_PAYLOAD, 'events tidak boleh kosong.');
  }
  if (body.events.length > env.analytics.collectMaxEvents) {
    throw new AppError(
      400,
      ErrorCodes.ANALYTICS_INVALID_PAYLOAD,
      `Maksimal ${env.analytics.collectMaxEvents} event per request.`,
    );
  }

  const visitorRaw = asString(body.visitor_id);
  const sessionRaw = asString(body.session_id);
  const visitorId = visitorRaw && isUuid(visitorRaw) ? visitorRaw : null;
  const sessionId = sessionRaw && isUuid(sessionRaw) ? sessionRaw : null;
  const incomplete = !visitorId || !sessionId;

  const page = body.page && typeof body.page === 'object' ? body.page : {};
  const path = normalizeAnalyticsPath(asString(page.path) ?? '/');
  const pageIdHint = parsePageId(null, path);
  const referrer = asString(page.referrer);
  const title = asString(page.title);
  const utm = parseUtm(page.utm);

  const events: SanitizedCollectEvent[] = [];
  for (const item of body.events) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const rec = item as CollectEventInput;
    const sanitized = sanitizeCollectEvent(rec, path, pageIdHint, incomplete);
    if (sanitized) {
      events.push(sanitized);
    }
  }

  return { visitorId, sessionId, incomplete, path, title, referrer, utm, events };
}

export function isBounceSession(input: {
  pageviewCount: number;
  clickCount: number;
  activeMs: number;
  maxScrollPercent: number;
}): boolean {
  return (
    input.pageviewCount === 1 &&
    input.clickCount === 0 &&
    input.activeMs < 10_000 &&
    input.maxScrollPercent < 25
  );
}
