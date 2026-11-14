import { isPersistedDbInitialized } from '@/infrastructure/persistence/memory-db';
import { registerRealtimeJob, runRealtimeSyncNow } from './RealtimeSync.job';
import { registerHistoricBackfillJob, runHistoricBackfillNow } from './HistoricBackfill.job';

/**
 * Composition root for scheduled work.
 * Called ONCE from server.ts after databaseService.init() — never from inside
 * DatabaseService, so DB wiring stays side-effect free (S5).
 */
export async function startScheduledJobs(): Promise<void> {
  await runRealtimeSyncNow();
  registerRealtimeJob();

  if (isPersistedDbInitialized()) {
    await runHistoricBackfillNow();
    registerHistoricBackfillJob();
  }
}

export function registerScheduledJobs(): void {
  registerRealtimeJob();
  if (isPersistedDbInitialized()) {
    registerHistoricBackfillJob();
  }
}
