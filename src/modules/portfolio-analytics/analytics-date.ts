import { JAKARTA_TZ } from './portfolio-analytics.constants';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Inclusive Jakarta calendar range → UTC instants. Jakarta has no DST (UTC+7). */
export function jakartaRangeToUtc(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00+07:00`),
    end: new Date(`${to}T23:59:59.999+07:00`),
  };
}

export function jakartaDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function eachJakartaDate(from: string, to: string): string[] {
  const dates: string[] = [];
  let cursor = new Date(`${from}T00:00:00+07:00`);
  const last = new Date(`${to}T00:00:00+07:00`);
  while (cursor.getTime() <= last.getTime()) {
    dates.push(jakartaDateString(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return dates;
}

export function defaultReportRange(): { from: string; to: string } {
  const now = new Date();
  const to = jakartaDateString(now);
  const from = jakartaDateString(new Date(now.getTime() - 13 * 24 * 60 * 60 * 1000));
  return { from, to };
}

export function mysqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 23).replace('T', ' ');
}

export { JAKARTA_TZ };
