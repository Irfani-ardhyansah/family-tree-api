import { ANALYTICS_PAGE_IDS, ROLLUP_PAGE_ALL } from './portfolio-analytics.constants';
import { jakartaDateString, jakartaRangeToUtc } from './analytics-date';
import { reportingRepository } from './reporting.repository';
import { reportingService } from './reporting.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 60 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;

async function rollupDate(bucketDate: string): Promise<void> {
  const pages = [null, ...ANALYTICS_PAGE_IDS] as const;
  for (const pageId of pages) {
    const query: Record<string, unknown> = {
      from: bucketDate,
      to: bucketDate,
      exclude_bots: 'true',
      ...(pageId ? { page_id: pageId } : {}),
    };
    const [overview, geo] = await Promise.all([
      reportingService.overview(query),
      reportingService.geo(query),
    ]);
    await reportingRepository.upsertDailyRollup({
      bucketDate,
      pageId: pageId ?? ROLLUP_PAGE_ALL,
      uniqueVisitors: overview.unique_visitors,
      sessions: overview.sessions,
      pageviews: overview.pageviews,
      outboundEmail: overview.outbounds.email,
      outboundWhatsapp: overview.outbounds.whatsapp,
      outboundInstagram: overview.outbounds.instagram,
      topCountries: geo.items.slice(0, 10),
      avgActiveMs: overview.avg_active_ms,
    });
  }
}

export async function runAnalyticsMaintenance(): Promise<void> {
  const yesterday = jakartaDateString(new Date(Date.now() - DAY_MS));
  await rollupDate(yesterday);

  const ipCutoff = new Date(Date.now() - 30 * DAY_MS);
  await reportingRepository.hashOldIps(ipCutoff);

  const eventCutoff = new Date(Date.now() - 90 * DAY_MS);
  await reportingRepository.deleteOldEvents(eventCutoff);

  const rollupCutoff = jakartaDateString(new Date(Date.now() - 365 * DAY_MS));
  await reportingRepository.deleteOldRollups(rollupCutoff);
}

export function startAnalyticsJobs(): void {
  if (timer) {
    return;
  }
  const run = () => {
    void runAnalyticsMaintenance().catch((error) => {
      console.error('[portfolio-analytics] maintenance failed', error);
    });
  };
  setTimeout(run, 30_000);
  timer = setInterval(run, INTERVAL_MS);
  timer.unref?.();
}

export { jakartaRangeToUtc };
