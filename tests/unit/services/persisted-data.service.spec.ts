import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { ListaEESSPrecio } from '@/infrastructure/providers/minetur/dto/ServiceStations.dto';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

// Mock CronJob
const mockCronJobFrom = vi.fn();
vi.mock('cron/dist/job', () => ({
  CronJob: {
    from: mockCronJobFrom,
  },
}));

// Mock logger
vi.mock('@/shared/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/shared/utils/numbers', () => ({
  twoDigits: vi.fn((n) => String(n).padStart(2, '0')),
}));
vi.mock('@/shared/utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// Mock DataProviderApiService
const mockGetStationsHistoric = vi.fn();
vi.mock('@/infrastructure/providers/minetur/data-provider-api.service', () => ({
  DataProviderApiService: {
    getStationsHistoric: mockGetStationsHistoric,
  },
}));

// Mock FuelStationsMapper
const mockMap = vi.fn((stations) =>
  stations.map((s: ListaEESSPrecio) => ({
    stationId: s.IDEESS,
    signage: s.Rótulo,
  }))
);
vi.mock('@/infrastructure/mappers', () => ({
  FuelStationsMapper: {
    map: mockMap,
  },
}));

// Mock the repository seam (services must not touch DB or drizzle directly)
const mockIsReady = vi.fn<() => boolean>(() => true);
const mockGetExistingDates = vi.fn<() => Promise<string[]>>(async () => []);
const mockGetNoDataDates = vi.fn<() => Promise<string[]>>(async () => []);
const mockInsertHistoricBatch = vi.fn<(rows: unknown[]) => Promise<void>>(async () => {});
const mockMarkNoDataDate = vi.fn<(date: string) => Promise<void>>(async () => {});
vi.mock('@/infrastructure/persistence/HistoricRepository', () => ({
  historicRepository: {
    isReady: () => mockIsReady(),
    getExistingDates: () => mockGetExistingDates(),
    getNoDataDates: () => mockGetNoDataDates(),
    insertHistoricBatch: (rows: unknown[]) => mockInsertHistoricBatch(rows),
    markNoDataDate: (date: string) => mockMarkNoDataDate(date),
  },
}));

describe('PersistedDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockGetExistingDates.mockResolvedValue([]);
    mockGetNoDataDates.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadStationsHistoric', () => {
    it('returns early when DB is not initialized', async () => {
      mockIsReady.mockReturnValue(false);

      const { logger } = await import('@/shared/utils/logger');
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith('❌ Persistent DB not initialized.');
      expect(mockGetExistingDates).not.toHaveBeenCalled();
    });

    it('returns early when no data exists in DB', async () => {
      mockGetExistingDates.mockResolvedValue([]);

      const { logger } = await import('@/shared/utils/logger');
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith(
        '❌ Persistent DB has no data. You must import manually the data first.'
      );
      expect(mockGetStationsHistoric).not.toHaveBeenCalled();
    });

    it('returns early when no new dates to fetch', async () => {
      const now = DateTime.local();
      const yesterday = now.minus({ days: 1 }).toSQLDate();
      const today = now.toSQLDate();

      mockGetExistingDates.mockResolvedValue([yesterday as string, today as string]);

      const { logger } = await import('@/shared/utils/logger');
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.info).toHaveBeenCalledWith('🗓️ No new dates to fetch for the historic');
    });

    it('fetches missing dates in batches of 7', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      mockGetExistingDates.mockResolvedValue([date1 as string]);
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [
          { IDEESS: 'ES001', Rótulo: 'Test' },
        ],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([{ stationId: 'ES001', signage: 'Test' }]);

      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should have fetched the missing dates and saved the batch through the repository
      expect(mockGetStationsHistoric).toHaveBeenCalled();
      expect(mockInsertHistoricBatch).toHaveBeenCalledTimes(1);
      const savedRows = mockInsertHistoricBatch.mock.calls[0][0] as { stationId: string }[];
      expect(savedRows[0].stationId).toBe('ES001');
    });

    it('splits more than 7 missing dates into several batches with sleep between them', async () => {
      const now = DateTime.local();
      // date1 is 15 days ago → 14 missing dates between it and yesterday
      const date1 = now.minus({ days: 15 }).toSQLDate();

      mockGetExistingDates.mockResolvedValue([date1 as string]);
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [{ IDEESS: 'ES001', Rótulo: 'Test' }],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([{ stationId: 'ES001', signage: 'Test' }]);

      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      const { sleep } = await import('@/shared/utils/sleep');
      await persistedDataService.loadStationsHistoric();

      // 14 missing dates → 2 full batches of 7, sleep only between batches
      expect(mockGetStationsHistoric).toHaveBeenCalledTimes(14);
      expect(mockInsertHistoricBatch).toHaveBeenCalledTimes(2);
      expect(sleep).toHaveBeenCalledTimes(1);
      expect(sleep).toHaveBeenCalledWith(60000);
    });

    it('marks dates with no data as no-data', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      mockGetExistingDates.mockResolvedValue([date1 as string]);
      // API returns empty array but valid Fecha - service marks as no-data
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([]);

      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // every hole (4 days since date1) returns empty → all marked as no-data
      expect(mockMarkNoDataDate).toHaveBeenCalledTimes(4);
      expect(typeof mockMarkNoDataDate.mock.calls[0][0]).toBe('string');
    });

    it('skips dates already in no-data set', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();
      const noDataDate = now.minus({ days: 4 }).toSQLDate();

      mockGetExistingDates.mockResolvedValue([date1 as string]);
      mockGetNoDataDates.mockResolvedValue([noDataDate as string]);
      mockGetStationsHistoric.mockResolvedValue(null);

      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should not fetch the no-data date
      const fetchedDates = mockGetStationsHistoric.mock.calls.map(call => call[0]);
      const hasNoDataDate = fetchedDates.some(d => d.toSQLDate() === noDataDate);
      expect(hasNoDataDate).toBe(false);
    });
  });

  describe('loadAll', () => {
    it('calls loadStationsHistoric', async () => {
      mockIsReady.mockReturnValue(false);

      const { logger } = await import('@/shared/utils/logger');
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadAll();

      // loadStationsHistoric should have run (and returned early: DB not initialized)
      expect(logger.error).toHaveBeenCalledWith('❌ Persistent DB not initialized.');
    });

    it('catches errors from loadStationsHistoric', async () => {
      mockGetExistingDates.mockRejectedValue(new Error('DB error'));

      const { logger } = await import('@/shared/utils/logger');
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      await persistedDataService.loadAll();

      // Should have logged the error
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('registerProgrammedTask', () => {
    it('registers a cron job with schedule 0 1 * * *', async () => {
      const { persistedDataService } = await import('@/infrastructure/sync/persisted-data.service');
      persistedDataService.registerProgrammedTask();

      expect(mockCronJobFrom).toHaveBeenCalledWith(
        expect.objectContaining({
          cronTime: '0 1 * * *',
          start: true,
        })
      );
    });
  });
});
