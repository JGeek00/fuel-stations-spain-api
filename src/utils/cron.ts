import { CronJob } from "cron";
import { loadPersistedDataProgrammed, loadRealtimeDataProgrammed } from "@/services/load-data";

export const startRealtimeDataCron = () => {
  // Trigger process on minute 1 and 31 of every hour: 1,31 * * * *
  // Every minute: 0 * * * * *

  CronJob.from({
    cronTime: process.env.REALTIME_DATA_CRON ?? '*/30 * * * *',
    onTick: loadRealtimeDataProgrammed,
    start: true,
    timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export const startPersistentDataCron = () => {
  // Trigger process every day at 01:00 AM: 0 1 * * *

  CronJob.from({
    cronTime: '0 1 * * *',
    onTick: loadPersistedDataProgrammed,
    start: true,
    timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}