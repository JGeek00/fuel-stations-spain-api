import { CronJob } from 'cron/dist/job';
import { persistedDataService } from '@/services/persisted-data.service';
import { logger } from '@/utils/logger';

/** Scheduled historic backfill — owns the cron, delegates loading to the service. */
export function registerHistoricBackfillJob(): void {
  CronJob.from({
    cronTime: '0 1 * * *',
    onTick: () => persistedDataService.loadAll(),
    start: true,
    timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  logger.info('  ⏰ Persisted data cron registered', { cronTime: '0 1 * * *' });
}

export async function runHistoricBackfillNow(): Promise<void> {
  await persistedDataService.loadAll();
}
