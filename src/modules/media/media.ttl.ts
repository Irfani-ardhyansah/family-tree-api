import { env } from '../../config/env';
import { mediaService } from './media.service';

let timer: NodeJS.Timeout | null = null;

export function startMediaTtlJob(): void {
  if (timer || env.media.ttlIntervalMs <= 0) {
    return;
  }

  const run = () => {
    void mediaService.purgeExpiredPending().then((count) => {
      if (count > 0 && !env.isProduction) {
        console.log(`[media-ttl] purged ${count} pending media`);
      }
    }).catch((error) => {
      console.error('[media-ttl] purge failed', error);
    });
  };

  // Initial sweep shortly after boot, then on interval.
  setTimeout(run, 15_000);
  timer = setInterval(run, env.media.ttlIntervalMs);
  timer.unref?.();
}
