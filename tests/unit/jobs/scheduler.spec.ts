import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock the job modules and the persisted-db seam ──────────────────────────
vi.mock('@/jobs/RealtimeSync.job', () => ({
  registerRealtimeJob: vi.fn(),
  runRealtimeSyncNow: vi.fn(),
}));
vi.mock('@/jobs/HistoricBackfill.job', () => ({
  registerHistoricBackfillJob: vi.fn(),
  runHistoricBackfillNow: vi.fn(),
}));
vi.mock('@/infrastructure/persistence/memory-db', () => ({
  isPersistedDbInitialized: vi.fn(),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────
import { startScheduledJobs, registerScheduledJobs } from '@/jobs/scheduler';
import { registerRealtimeJob, runRealtimeSyncNow } from '@/jobs/RealtimeSync.job';
import { registerHistoricBackfillJob, runHistoricBackfillNow } from '@/jobs/HistoricBackfill.job';
import { isPersistedDbInitialized } from '@/infrastructure/persistence/memory-db';

const mockRunRealtime = vi.mocked(runRealtimeSyncNow) as Mock;
const mockRegisterRealtime = vi.mocked(registerRealtimeJob) as Mock;
const mockRunBackfill = vi.mocked(runHistoricBackfillNow) as Mock;
const mockRegisterBackfill = vi.mocked(registerHistoricBackfillJob) as Mock;
const mockIsPersistedInitialized = vi.mocked(isPersistedDbInitialized) as Mock;

describe('jobs/scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunRealtime.mockResolvedValue(undefined);
    mockRunBackfill.mockResolvedValue(undefined);
  });

  describe('startScheduledJobs', () => {
    it('runs the initial realtime sync, then registers the realtime cron', async () => {
      mockIsPersistedInitialized.mockReturnValue(false);

      await startScheduledJobs();

      expect(mockRunRealtime).toHaveBeenCalledTimes(1);
      expect(mockRegisterRealtime).toHaveBeenCalledTimes(1);
      // Initial load happens BEFORE the cron registers, so the first tick
      // does not double-load while the first run is still in flight.
      expect(mockRunRealtime.mock.invocationCallOrder[0]).toBeLessThan(mockRegisterRealtime.mock.invocationCallOrder[0]);
    });

    it('also runs and registers the historic backfill when the persisted db is initialized', async () => {
      mockIsPersistedInitialized.mockReturnValue(true);

      await startScheduledJobs();

      expect(mockRunBackfill).toHaveBeenCalledTimes(1);
      expect(mockRegisterBackfill).toHaveBeenCalledTimes(1);
      expect(mockRunBackfill.mock.invocationCallOrder[0]).toBeGreaterThan(mockRegisterRealtime.mock.invocationCallOrder[0]);
      expect(mockRegisterBackfill.mock.invocationCallOrder[0]).toBeGreaterThan(mockRunBackfill.mock.invocationCallOrder[0]);
    });

    it('skips the historic backfill entirely without an initialized persisted db', async () => {
      mockIsPersistedInitialized.mockReturnValue(false);

      await startScheduledJobs();

      expect(mockRunBackfill).not.toHaveBeenCalled();
      expect(mockRegisterBackfill).not.toHaveBeenCalled();
    });
  });

  describe('registerScheduledJobs', () => {
    it('registers the realtime cron and skips the backfill without a persisted db', () => {
      mockIsPersistedInitialized.mockReturnValue(false);

      registerScheduledJobs();

      expect(mockRegisterRealtime).toHaveBeenCalledTimes(1);
      expect(mockRegisterBackfill).not.toHaveBeenCalled();
    });

    it('registers both crons when the persisted db is initialized', () => {
      mockIsPersistedInitialized.mockReturnValue(true);

      registerScheduledJobs();

      expect(mockRegisterRealtime).toHaveBeenCalledTimes(1);
      expect(mockRegisterBackfill).toHaveBeenCalledTimes(1);
    });
  });
});
