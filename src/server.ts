import './shared/types/express';
import { createApp } from './app';
import { env } from './config/env';
import { startAutoCleanupJob } from './modules/core/admin/admin-cleanup.jobs';
import { startMediaTtlJob } from './modules/core/media/media.ttl';
import { startAnalyticsJobs } from './modules/portfolio-analytics/analytics.jobs';
import { recoverPersonImportJobs } from './modules/family-roots/persons/import/person-import.worker';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
  startMediaTtlJob();
  startAutoCleanupJob();
  startAnalyticsJobs();
  void recoverPersonImportJobs().catch((error) => {
    console.error('[person-import] recovery failed', error);
  });
});
