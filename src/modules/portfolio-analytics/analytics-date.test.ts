import { describe, expect, it } from 'vitest';
import { eachJakartaDate, isIsoDate, jakartaDateString, jakartaRangeToUtc } from './analytics-date';
import { parseAnalyticsUserAgent } from './parse-analytics-ua';
import { parseReportRange } from './reporting.service';

describe('jakarta date helpers', () => {
  it('converts inclusive Jakarta range to UTC instants', () => {
    const { start, end } = jakartaRangeToUtc('2026-09-01', '2026-09-14');
    expect(start.toISOString()).toBe('2026-08-31T17:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-14T16:59:59.999Z');
  });

  it('lists each calendar day inclusive', () => {
    expect(eachJakartaDate('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
    ]);
  });

  it('formats a UTC instant as Jakarta date', () => {
    expect(jakartaDateString(new Date('2026-09-14T16:30:00.000Z'))).toBe('2026-09-14');
    expect(jakartaDateString(new Date('2026-09-14T17:30:00.000Z'))).toBe('2026-09-15');
  });

  it('validates ISO dates', () => {
    expect(isIsoDate('2026-09-14')).toBe(true);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('14-09-2026')).toBe(false);
  });
});

describe('parseReportRange', () => {
  it('parses from/to and defaults exclude_bots true', () => {
    const range = parseReportRange({ from: '2026-09-01', to: '2026-09-14' });
    expect(range.excludeBots).toBe(true);
    expect(range.timezone).toBe('Asia/Jakarta');
    expect(range.pageId).toBeNull();
  });

  it('rejects inverted range', () => {
    expect(() => parseReportRange({ from: '2026-09-14', to: '2026-09-01' })).toThrow();
  });
});

describe('parseAnalyticsUserAgent', () => {
  it('flags empty UA as bot', () => {
    expect(parseAnalyticsUserAgent('').isBot).toBe(true);
    expect(parseAnalyticsUserAgent(undefined).device).toBe('unknown');
  });

  it('detects mobile Chrome', () => {
    const ua =
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
    const parsed = parseAnalyticsUserAgent(ua);
    expect(parsed.device).toBe('mobile');
    expect(parsed.browser).toBe('Chrome');
    expect(parsed.os).toBe('Android');
    expect(parsed.isBot).toBe(false);
  });

  it('detects Googlebot', () => {
    expect(parseAnalyticsUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.com/bot.html)').isBot).toBe(
      true,
    );
  });
});
