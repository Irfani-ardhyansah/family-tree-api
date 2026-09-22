import { describe, expect, it } from 'vitest';
import { AppError } from '../../shared/errors/AppError';
import {
  isAllowedAnalyticsPath,
  isBounceSession,
  parseCollectBody,
  sanitizeCollectEvent,
} from './collect.parser';

const visitor = '8c1d0c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f';
const session = 'b91e2a10-1111-4aaa-8bbb-cccccccccccc';

function pageView(id = 'f0a10c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f') {
  return {
    event_id: id,
    name: 'page_view',
    ts: '2026-09-14T14:32:01.010Z',
    props: { page_id: 'home' },
  };
}

describe('isAllowedAnalyticsPath', () => {
  it('allows home and work with or without /portfolio prefix', () => {
    expect(isAllowedAnalyticsPath('/')).toBe(true);
    expect(isAllowedAnalyticsPath('/work/')).toBe(true);
    expect(isAllowedAnalyticsPath('/portfolio/')).toBe(true);
    expect(isAllowedAnalyticsPath('/portfolio/work')).toBe(true);
  });

  it('rejects scanner paths', () => {
    expect(isAllowedAnalyticsPath('/.env')).toBe(false);
    expect(isAllowedAnalyticsPath('/wp-admin')).toBe(false);
  });
});

describe('parseCollectBody', () => {
  it('accepts a valid page_view batch', () => {
    const batch = parseCollectBody({
      schema_version: 1,
      visitor_id: visitor,
      session_id: session,
      page: { path: '/portfolio/', referrer: 'https://www.linkedin.com/' },
      events: [pageView()],
    });
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.name).toBe('page_view');
    expect(batch.incomplete).toBe(false);
  });

  it('marks incomplete when visitor/session missing but keeps page_view', () => {
    const batch = parseCollectBody({
      schema_version: 1,
      page: { path: '/' },
      events: [pageView()],
    });
    expect(batch.incomplete).toBe(true);
    expect(batch.events).toHaveLength(1);
    expect(batch.events[0]?.incomplete).toBe(true);
  });

  it('drops non-page_view when identity is missing', () => {
    const batch = parseCollectBody({
      schema_version: 1,
      page: { path: '/' },
      events: [
        pageView(),
        {
          event_id: 'a1a10c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f',
          name: 'click',
          ts: '2026-09-14T14:32:02.000Z',
          props: { element_id: 'nav_work' },
        },
      ],
    });
    expect(batch.events.map((e) => e.name)).toEqual(['page_view']);
  });

  it('drops unknown click element_id', () => {
    const event = sanitizeCollectEvent(
      {
        event_id: 'a1a10c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f',
        name: 'click',
        ts: '2026-09-14T14:32:02.000Z',
        props: { element_id: 'random_div' },
      },
      '/portfolio/',
      'home',
      false,
    );
    expect(event).toBeNull();
  });

  it('keeps work card click via work_slug', () => {
    const event = sanitizeCollectEvent(
      {
        event_id: 'a1a10c5a-2f3a-4b1e-9c0d-1a2b3c4d5e6f',
        name: 'click',
        ts: '2026-09-14T14:32:02.000Z',
        props: { work_slug: 'kledo' },
      },
      '/portfolio/',
      'home',
      false,
    );
    expect(event?.name).toBe('click');
  });

  it('rejects bad schema_version', () => {
    expect(() => parseCollectBody({ schema_version: 2, events: [pageView()] })).toThrow(AppError);
  });
});

describe('isBounceSession', () => {
  it('matches v1 bounce definition', () => {
    expect(
      isBounceSession({ pageviewCount: 1, clickCount: 0, activeMs: 4000, maxScrollPercent: 10 }),
    ).toBe(true);
    expect(
      isBounceSession({ pageviewCount: 2, clickCount: 0, activeMs: 4000, maxScrollPercent: 10 }),
    ).toBe(false);
    expect(
      isBounceSession({ pageviewCount: 1, clickCount: 1, activeMs: 4000, maxScrollPercent: 10 }),
    ).toBe(false);
  });
});
