import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ── Mock cron and the sync service seam ─────────────────────────────────────
vi.mock('cron', () => ({ CronJob: { from: vi.fn() } }));
vi.mock('@/infrastructure/sync/realtime-data.service', () => ({
  realtimeDataService: { loadAll: vi.fn() },
}));
vi.mock('@/shared/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { registerRealtimeJob, runRealtimeSyncNow } from '@/jobs/RealtimeSync.job';
import { CronJob } from 'cron';
import { realtimeDataService } from '@/infrastructure/sync/realtime-data.service';

const mockFrom = vi.mocked(CronJob.from) as Mock;
const mockLoadAll = vi.mocked(realtimeDataService.loadAll) as Mock;

describe('RealtimeSync.job', () => {
  const originalCron = process.env.REALTIME_DATA_CRON;
  const originalTz = process.env.TZ;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.REALTIME_DATA_CRON;
    delete process.env.TZ;
  });

  afterEach(() => {
    if (originalCron !== undefined) process.env.REALTIME_DATA_CRON = originalCron;
    else delete process.env.REALTIME_DATA_CRON;
    if (originalTz !== undefined) process.env.TZ = originalTz;
    else delete process.env.TZ;
  });

  it('registers a started cron job with the default schedule', () => {
    registerRealtimeJob();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    const options = mockFrom.mock.calls[0][0];
    expect(options.cronTime).toBe('0,30 * * * *');
    expect(options.start).toBe(true);
    expect(options.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('honors the REALTIME_DATA_CRON and TZ environment overrides', () => {
    process.env.REALTIME_DATA_CRON = '15 * * * *';
    process.env.TZ = 'Europe/Madrid';

    registerRealtimeJob();

    const options = mockFrom.mock.calls[0][0];
    expect(options.cronTime).toBe('15 * * * *');
    expect(options.timeZone).toBe('Europe/Madrid');
  });

  it('ticks into the realtime service load', () => {
    registerRealtimeJob();

    const { onTick } = mockFrom.mock.calls[0][0];
    onTick();
    onTick();

    expect(mockLoadAll).toHaveBeenCalledTimes(2);
  });

  it('runs a one-off sync through the same service seam', async () => {
    await runRealtimeSyncNow();

    expect(mockLoadAll).toHaveBeenCalledTimes(1);
  });
});
