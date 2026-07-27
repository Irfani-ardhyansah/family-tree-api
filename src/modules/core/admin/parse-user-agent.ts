export type ParsedUserAgent = {
  device: string;
  browser: string;
};

/** Lightweight UA parse — enough for admin session list without extra deps. */
export function parseUserAgent(userAgent: string | null | undefined): ParsedUserAgent {
  const ua = (userAgent ?? '').trim();
  if (!ua) {
    return { device: 'Unknown', browser: 'Unknown' };
  }

  const browser = detectBrowser(ua);
  const device = detectDevice(ua);
  return { device, browser };
}

function detectBrowser(ua: string): string {
  if (/Edg\//i.test(ua)) return 'Edge';
  if (/OPR\/|Opera/i.test(ua)) return 'Opera';
  if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
  if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    if (/Mobile/i.test(ua)) return 'Chrome Mobile';
    return 'Chrome';
  }
  if (/Firefox\//i.test(ua)) {
    if (/Mobile/i.test(ua)) return 'Firefox Mobile';
    return 'Firefox';
  }
  if (/Safari\//i.test(ua) && /Version\//i.test(ua)) {
    if (/iPhone|iPad|iPod/i.test(ua)) return 'Safari iOS';
    return 'Safari';
  }
  if (/MSIE |Trident\//i.test(ua)) return 'Internet Explorer';
  return 'Unknown';
}

function detectDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) return 'Android Phone';
    return 'Android Tablet';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows PC';
  if (/Linux/i.test(ua)) return 'Linux';
  if (/CrOS/i.test(ua)) return 'Chromebook';
  return 'Unknown';
}
