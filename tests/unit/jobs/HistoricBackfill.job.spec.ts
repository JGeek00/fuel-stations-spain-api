import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

// ── Mock cron and the sync service seam ─────────────────────────────────────
vi.mock('cron/dist/job', () => ({ CronJob: { from: vi.fn() } }));
vi.mock('@/infrastructure/sync/persisted-data.service', () => ({
  persistedDataService: { loadAll: vi.fn() },
}));
vi.mock('@/shared/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { registerHistoricBackfillJob, runHistoricBackfillNow } from '@/jobs/HistoricBackfill.job';
import { CronJob } from 'cron/dist/job';
import { persistedDataService } from '@/infrastructure/sync/persisted-data.service';

const mockFrom = vi.mocked(CronJob.from) as Mock;
const mockLoadAll = vi.mocked(persistedDataService.loadAll) as Mock;

describe('HistoricBackfill.job', () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.TZ;
  });

  afterEach(() => {
    if (originalTz !== undefined) process.env.TZ = originalTz;
    else delete process.env.TZ;
  });

  it('registers a started nightly cron job at 01:00', () => {
    registerHistoricBackfillJob();

    expect(mockFrom).toHaveBeenCalledTimes(1);
    const options = mockFrom.mock.calls[0][0];
    expect(options.cronTime).toBe('0 1 * * *');
    expect(options.start).toBe(true);
    expect(options.timeZone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
  });

  it('honors the TZ environment override for the nightly schedule', () => {
    process.env.TZ = 'Europe/Madrid';

    registerHistoricBackfillJob();

    expect(mockFrom.mock.calls[0][0].timeZone).toBe('Europe/Madrid');
  });

  it('ticks into the persisted service load', () => {
    registerHistoricBackfillJob();

    const { onTick } = mockFrom.mock.calls[0][0];
    onTick();

    expect(mockLoadAll).toHaveBeenCalledTimes(1);
  });

  it('runs a one-off backfill through the same service seam', async () => {
    await runHistoricBackfillNow();

    expect(mockLoadAll).toHaveBeenCalledTimes(1);
  });
});
