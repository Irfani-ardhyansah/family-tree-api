import { env } from '../../../config/env';
import { adminCleanupService } from './admin-cleanup.service';

let timer: NodeJS.Timeout | null = null;

/**
 * Scheduler pembersihan otomatis admin. Berjalan di dalam proses API (bukan
 * cron OS). Tiap tick memastikan baris settings ada, lalu menjalankan
 * pembersihan untuk keluarga yang `enabled=true`.
 */
export function startAutoCleanupJob(): void {
  const intervalMs = env.autoCleanup.intervalMinutes * 60 * 1000;
  if (timer || intervalMs <= 0) return;

  const run = () => {
    void adminCleanupService.runAllEnabled().catch((error) => {
      console.error('[admin-cleanup] scheduler failed', error);
    });
  };

  // Sweep awal singkat setelah boot, lalu berkala.
  setTimeout(run, 20_000).unref?.();
  timer = setInterval(run, intervalMs);
  timer.unref?.();
}
