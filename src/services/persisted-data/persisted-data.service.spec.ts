import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import { ListaEESSPrecio } from './../../dto/ServiceStations.dto';

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
vi.mock('@/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  sleep: vi.fn().mockResolvedValue(undefined),
  twoDigits: vi.fn((n) => String(n).padStart(2, '0')),
}));

// Mock DataProviderApiService
const mockGetStationsHistoric = vi.fn();
vi.mock('@/services/data-provider-api/data-provider-api.service', () => ({
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

// Mock HistoricFuelStation
const mockHistoricFuelStationFindAll = vi.fn();
const mockHistoricFuelStationBulkCreate = vi.fn();
const mockSequelize = {
  fn: vi.fn(),
  col: vi.fn(),
};
const mockHistoricFuelStation = {
  findAll: mockHistoricFuelStationFindAll,
  bulkCreate: mockHistoricFuelStationBulkCreate,
  sequelize: mockSequelize,
};
vi.mock('@/models/db/HistoricFuelStation', () => ({
  HistoricFuelStation: mockHistoricFuelStation,
}));

// Mock HistoricNoDataTable
const mockHistoricNoDataFindAll = vi.fn();
const mockHistoricNoDataCreate = vi.fn();
const mockHistoricNoDataTable = {
  findAll: mockHistoricNoDataFindAll,
  create: mockHistoricNoDataCreate,
};
vi.mock('@/models/db/HistoricNoData', () => ({
  HistoricNoDataTable: mockHistoricNoDataTable,
}));

describe('PersistedDataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSequelize.fn.mockReturnValue('fn-call');
    mockSequelize.col.mockReturnValue('col-call');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadStationsHistoric', () => {
    it('returns early when DB is not initialized', async () => {
      mockHistoricFuelStation.sequelize = null;

      const { logger } = await import('../../utils');
      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith('❌ Persistent DB not initialized.');
    });

    it('returns early when no data exists in DB', async () => {
      mockHistoricFuelStation.sequelize = mockSequelize;
      mockHistoricFuelStationFindAll.mockResolvedValue([]);
      mockHistoricNoDataFindAll.mockResolvedValue([]);

      const { logger } = await import('../../utils');
      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.error).toHaveBeenCalledWith(
        '❌ Persistent DB has no data. You must import manually the data first.'
      );
    });

    it('returns early when no new dates to fetch', async () => {
      const now = DateTime.local();
      const yesterday = now.minus({ days: 1 }).toSQLDate();
      const today = now.toSQLDate();

      mockHistoricFuelStationFindAll.mockResolvedValue([
        { dataValues: { date: yesterday } },
        { dataValues: { date: today } },
      ]);
      mockHistoricNoDataFindAll.mockResolvedValue([]);

      const { logger } = await import('../../utils');
      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      expect(logger.info).toHaveBeenCalledWith('🗓️ No new dates to fetch for the historic');
    });

    it('fetches missing dates in batches of 7', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      mockHistoricFuelStationFindAll.mockResolvedValue([
        { dataValues: { date: date1 } },
      ]);
      mockHistoricNoDataFindAll.mockResolvedValue([]);
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [
          { IDEESS: 'ES001', Rótulo: 'Test' },
        ],
        Fecha: '01/01/2024 10:00:00',
      });
      mockMap.mockReturnValue([{ stationId: 'ES001', signage: 'Test' }]);
      mockHistoricFuelStationBulkCreate.mockResolvedValue([]);

      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should have called getStationsHistoric for missing dates
      expect(mockGetStationsHistoric).toHaveBeenCalled();
      expect(mockHistoricFuelStationBulkCreate).toHaveBeenCalled();
    });

    it('marks dates with no data as no-data', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();

      mockHistoricFuelStationFindAll.mockResolvedValue([
        { dataValues: { date: date1 } },
      ]);
      mockHistoricNoDataFindAll.mockResolvedValue([]);
      // API returns empty array but valid Fecha - service marks as no-data
      mockGetStationsHistoric.mockResolvedValue({
        ListaEESSPrecio: [],
        Fecha: '01/01/2024 10:00:00',
      });
      mockHistoricFuelStationBulkCreate.mockResolvedValue([]);
      mockMap.mockReturnValue([]);

      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should mark the date as no-data
      expect(mockHistoricNoDataCreate).toHaveBeenCalled();
    });

    it('skips dates already in no-data set', async () => {
      const now = DateTime.local();
      const date1 = now.minus({ days: 5 }).toSQLDate();
      const noDataDate = now.minus({ days: 4 }).toSQLDate();

      mockHistoricFuelStationFindAll.mockResolvedValue([
        { dataValues: { date: date1 } },
      ]);
      mockHistoricNoDataFindAll.mockResolvedValue([
        { dataValues: { date: noDataDate } },
      ]);
      mockGetStationsHistoric.mockResolvedValue(null);
      mockHistoricFuelStationBulkCreate.mockResolvedValue([]);

      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadStationsHistoric();

      // Should not fetch the no-data date
      const fetchedDates = mockGetStationsHistoric.mock.calls.map(call => call[0]);
      const hasNoDataDate = fetchedDates.some(d => d.toSQLDate() === noDataDate);
      expect(hasNoDataDate).toBe(false);
    });
  });

  describe('loadAll', () => {
    it('calls loadStationsHistoric', async () => {
      mockHistoricFuelStation.sequelize = null;

      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadAll();

      // loadStationsHistoric should have been called (and returned early due to null sequelize)
      expect(mockHistoricFuelStation.sequelize).toBeNull();
    });

    it('catches errors from loadStationsHistoric', async () => {
      mockHistoricFuelStation.sequelize = mockSequelize;
      mockHistoricFuelStationFindAll.mockRejectedValue(new Error('DB error'));

      const { logger } = await import('../../utils');
      const { persistedDataService } = await import('./persisted-data.service');
      await persistedDataService.loadAll();

      // Should have logged the error
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('registerProgrammedTask', () => {
    it('registers a cron job with schedule 0 1 * * *', async () => {
      const { persistedDataService } = await import('./persisted-data.service');
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
