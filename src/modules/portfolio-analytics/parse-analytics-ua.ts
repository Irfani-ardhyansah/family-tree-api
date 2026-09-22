import { BOT_UA_PATTERNS } from './portfolio-analytics.constants';
import { ParsedAnalyticsUa } from './portfolio-analytics.types';

export function parseAnalyticsUserAgent(userAgent: string | null | undefined): ParsedAnalyticsUa {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return { device: 'unknown', os: 'Unknown', browser: 'Unknown', isBot: true };
  }

  return {
    device: detectDevice(ua),
    os: detectOs(ua),
    browser: detectBrowser(ua),
    isBot: isBotUserAgent(ua),
  };
}

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return true;
  }
  return BOT_UA_PATTERNS.some((pattern) => pattern.test(ua));
}

function detectDevice(ua: string): ParsedAnalyticsUa['device'] {
  if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || /Tablet/i.test(ua)) {
    return 'tablet';
  }
  if (/Mobi|iPhone|iPod|Android.+Mobile/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows NT/i.test(ua)) return 'Windows';
  if (/Mac OS X/i.test(ua)) return 'macOS';
  if (/CrOS/i.test(ua)) return 'ChromeOS';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) return 'Chrome';
  if (/Firefox\//i.test(ua)) return 'Firefox';
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) return 'Safari';
  if (/MSIE |Trident\//i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}
