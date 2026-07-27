import { describe, expect, it } from 'vitest';
import { parseUserAgent } from './parse-user-agent';

describe('parseUserAgent', () => {
  it('returns Unknown for empty UA', () => {
    expect(parseUserAgent(undefined)).toEqual({ device: 'Unknown', browser: 'Unknown' });
    expect(parseUserAgent('')).toEqual({ device: 'Unknown', browser: 'Unknown' });
  });

  it('detects iPhone Safari', () => {
    const ua =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    expect(parseUserAgent(ua)).toEqual({ device: 'iPhone', browser: 'Safari iOS' });
  });

  it('detects Windows Chrome', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    expect(parseUserAgent(ua)).toEqual({ device: 'Windows PC', browser: 'Chrome' });
  });
});
