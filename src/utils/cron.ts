import { CronJob } from "cron";
import { loadDataProgrammed } from "@/services/load-data";

// Trigger process on minute 1 and 31 of every hour: 1,31 * * * *
// Every minute: 0 * * * * *

export const startCronJob = () => {
  CronJob.from({
    cronTime: '1,31 * * * *',
    onTick: loadDataProgrammed,
    start: true,
    timeZone: 'Europe/Madrid',
  });
}