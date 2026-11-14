import { CronJob } from 'cron';
import { realtimeDataService } from '@/infrastructure/sync/realtime-data.service';
import { logger } from '@/shared/utils/logger';

/** Scheduled realtime sync — owns the cron, delegates loading to the service. */
export function registerRealtimeJob(): void {
  CronJob.from({
    cronTime: process.env.REALTIME_DATA_CRON ?? '0,30 * * * *',
    onTick: () => realtimeDataService.loadAll(),
    start: true,
    timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  logger.info('  ⏰ Realtime data cron registered', { cronTime: process.env.REALTIME_DATA_CRON ?? '0,30 * * * *' });
}

export async function runRealtimeSyncNow(): Promise<void> {
  await realtimeDataService.loadAll();
}
