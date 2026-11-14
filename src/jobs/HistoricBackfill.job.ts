import { CronJob } from 'cron/dist/job';
import { persistedDataService } from '@/infrastructure/sync/persisted-data.service';
import { logger } from '@/shared/utils/logger';

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
