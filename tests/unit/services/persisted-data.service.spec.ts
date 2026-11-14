import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { ListaEESSPrecio } from '@/dto/ServiceStations.dto';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

// Mock randomUUID
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-' + Math.random()),
}));

// Mock CronJob
const mockCronJobFrom = vi.fn();
vi.mock('cron/dist/job', () => ({
  CronJob: {
    from: mockCronJobFrom,
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/utils/numbers', () => ({
  twoDigits: vi.fn((n) => String(n).padStart(2, '0')),
}));
vi.mock('@/utils/sleep', () => ({
  sleep: vi.fn().mockResolvedValue(undefined),
}));

// Mock DataProviderApiService
const mockGetStationsHistoric = vi.fn();
vi.mock('@/services/data-provider-api.service', () => ({
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
vi.mock('@/mapper', () => ({
  FuelStationsMapper: {
    map: mockMap,
  },
}));

// Drizzle memory DB seam (src/models/db/memory-db.ts)
const {
  mockDb,
  mockIsPersistedDbInitialized,
  historicFuelStationsTable,
  historicNoDataTable,
} = vi.hoisted(() => ({
  mockDb: {
    selectDistinct: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
  },
  mockIsPersistedDbInitialized: vi.fn<() => boolean>(),
  historicFuelStationsTable: { name: 'historicFuelStationsTable' },
  historicNoDataTable: { name: 'historicNoDataTable' },
}));
vi.mock('@/models/db/memory-db', () => ({
  getMemoryDb: () => mockDb,
  isPersistedDbInitialized: mockIsPersistedDbInitialized,
  historicFuelStationsTable,
  historicNoDataTable,
}));

interface InsertedRow {
  table: unknown;
  values: unknown;
  conflictIgnored?: boolean;
}
let insertedRows: InsertedRow[] = [];

// Wires the mockDb chain for one scenario.
const seedDb = (options: {
  existingDates?: { date: string }[];
  noDataDates?: { date: string }[];
  rejectDistinct?: boolean;
} = {}) => {
  insertedRows = [];
  mockDb.selectDistinct.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      orderBy: vi.fn(() =>
        options.rejectDistinct ? Promise.reject(new Error('DB error')) : Promise.resolve(options.existingDates ?? [])
      ),
    }),
  }));
  mockDb.select.mockImplementation(() => ({
    from: vi.fn(async () => options.noDataDates ?? []),
  }));
  mockDb.insert.mockImplementation((table: unknown) => ({
    values: vi.fn((values: unknown) => {
      const entry: InsertedRow = { table, values };
      insertedRows.push(entry);
      return {
        onConflictDoNothing: vi.fn(async () => {
          entry.conflictIgnored = true;
        }),
      };
    }),
  }));
};

describe('PersistedDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPersistedDbInitialized.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadStationsHistoric', () => {
    it('returns early when DB is not initialized', async () => {
      mockIsPersistedDbInitialized.mockReturnValue(false);

      const { logger } = await import('@/utils/logger');
      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith('❌ Persistent DB not initialized.');
      expect(mockDb.selectDistinct).not.toHaveBeenCalled();
    });

    it('returns early when no data exists in DB', async () => {
      seedDb({ existingDates: [] });

      const { logger } = await import('@/utils/logger');
      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith(
        '❌ Persistent DB has no data. You must import manually the data first.'
      );
    });

    it('returns early when no new dates to fetch', async () => {
      const now = DateTime.local();
      const yesterday = now.minus({ days: 1 }).toSQLDate();
      const today = now.toSQLDate();

      seedDb({ existingDates: [{ date: yesterday as string }, { date: today as string }] });

      const { logger } = await import('@/utils/logger');
      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.info).toHaveBeenCalledWith('🗓️ No new dates to fetch for the historic');
    });

    it('fetches missing dates in batches of 7', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      seedDb({ existingDates: [{ date: date1 as string }] });
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [
          { IDEESS: 'ES001', Rótulo: 'Test' },
        ],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([{ stationId: 'ES001', signage: 'Test' }]);

      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should have called getStationsHistoric for missing dates and saved the
      // batch with the conflict-ignore equivalent
      expect(mockGetStationsHistoric).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledWith(historicFuelStationsTable);
      const historicInsert = insertedRows.find((row) => row.table === historicFuelStationsTable);
      expect(historicInsert).toBeDefined();
      expect(historicInsert?.conflictIgnored).toBe(true);
      expect((historicInsert?.values as { stationId: string }[])[0].stationId).toBe('ES001');
    });

    it('marks dates with no data as no-data', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      seedDb({ existingDates: [{ date: date1 as string }] });
      // API returns empty array but valid Fecha - service marks as no-data
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([]);

      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should mark the date as no-data
      expect(mockDb.insert).toHaveBeenCalledWith(historicNoDataTable);
      expect(insertedRows.some((row) => row.table === historicNoDataTable)).toBe(true);
    });

    it('skips dates already in no-data set', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();
      const noDataDate = now.minus({ days: 4 }).toSQLDate();

      seedDb({
        existingDates: [{ date: date1 as string }],
        noDataDates: [{ date: noDataDate as string }],
      });
      mockGetStationsHistoric.mockResolvedValue(null);

      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should not fetch the no-data date
      const fetchedDates = mockGetStationsHistoric.mock.calls.map(call => call[0]);
      const hasNoDataDate = fetchedDates.some(d => d.toSQLDate() === noDataDate);
      expect(hasNoDataDate).toBe(false);
    });
  });

  describe('loadAll', () => {
    it('calls loadStationsHistoric', async () => {
      mockIsPersistedDbInitialized.mockReturnValue(false);

      const { logger } = await import('@/utils/logger');
      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadAll();

      // loadStationsHistoric should have run (and returned early: DB not initialized)
      expect(logger.error).toHaveBeenCalledWith('❌ Persistent DB not initialized.');
    });

    it('catches errors from loadStationsHistoric', async () => {
      seedDb({ rejectDistinct: true });

      const { logger } = await import('@/utils/logger');
      const { persistedDataService } = await import('@/services/persisted-data.service');
      await persistedDataService.loadAll();

      // Should have logged the error
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('registerProgrammedTask', () => {
    it('registers a cron job with schedule 0 1 * * *', async () => {
      const { persistedDataService } = await import('@/services/persisted-data.service');
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
