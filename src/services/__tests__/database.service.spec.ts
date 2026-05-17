import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

// Mock logger
vi.mock('@/utils', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock validatePostgresDbData
const mockValidatePostgresDbData = vi.fn(() => false);
vi.mock('@/utils/postgres-db/postgres-db', () => ({
  validatePostgresDbData: mockValidatePostgresDbData,
}));

// Mock Sequelize constructor
const createMockSequelize = () => {
  const instances: Map<string, Record<string, unknown>> = new Map();
  const MockSequelize = vi.fn().mockImplementation(function (config) {
    const key = JSON.stringify(config);
    const instance = {
      config,
      authenticate: vi.fn().mockResolvedValue(undefined),
      sync: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue([[{ has_tables: false }]]),
      close: vi.fn().mockResolvedValue(undefined),
    };
    instances.set(key, instance);
    return instance;
  });
  return { MockSequelize, instances };
};

const { MockSequelize, instances: mockSequelizeInstances } = createMockSequelize();
vi.mock('sequelize', () => ({
  Sequelize: MockSequelize,
}));

// Mock FuelStationModel and FuelStationsTable
const mockFuelStationModel = { id: 'id', stationId: 'stationId' };
const mockFuelStationsTable = {
  init: vi.fn(),
};
vi.mock('@/models/db/FuelStations', () => ({
  FuelStationModel: mockFuelStationModel,
  FuelStationsTable: mockFuelStationsTable,
}));

// Mock LastUpdated
const mockLastUpdatedModel = { id: 'id', lastUpdated: 'lastUpdated' };
const mockLastUpdated = {
  init: vi.fn(),
};
vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: mockLastUpdated,
  LastUpdatedModel: mockLastUpdatedModel,
}));

// Mock HistoricFuelStation
const mockHistoricFuelStationModel = {};
const mockHistoricFuelStation = {
  init: vi.fn(),
};
vi.mock('@/models/db/HistoricFuelStation', () => ({
  HistoricFuelStation: mockHistoricFuelStation,
  HistoricFuelStationModel: mockHistoricFuelStationModel,
}));

// Mock HistoricNoData
const mockHistoricNoDataModel = {};
const mockHistoricNoDataTable = {
  init: vi.fn(),
};
vi.mock('@/models/db/HistoricNoData', () => ({
  HistoricNoDataModel: mockHistoricNoDataModel,
  HistoricNoDataTable: mockHistoricNoDataTable,
}));

// Mock Migrations
const mockMigrationsModel = {};
const mockMigrations = {
  init: vi.fn(),
  sync: vi.fn().mockResolvedValue(undefined),
  bulkCreate: vi.fn().mockResolvedValue([]),
};
vi.mock('@/models/db/Migrations', () => ({
  Migrations: mockMigrations,
  MigrationsModel: mockMigrationsModel,
}));

// Mock migrationService
const mockMigrationService = {
  isDbEmpty: vi.fn().mockResolvedValue(true),
  run: vi.fn().mockResolvedValue(undefined),
};
vi.mock('@/services/migration.service', () => ({
  migrationService: mockMigrationService,
}));

// Mock MIGRATIONS
vi.mock('@/migrations', () => ({
  MIGRATIONS: [
    { version: '001', name: 'baseline' },
    { version: '002', name: 'unique_station_date' },
  ],
}));

// Mock realtimeDataService
const mockRealtimeDataService = {
  loadAll: vi.fn(),
  registerProgrammedTask: vi.fn(),
};
vi.mock('@/services/realtime-data.service', () => ({
  realtimeDataService: mockRealtimeDataService,
}));

// Mock persistedDataService
const mockPersistedDataService = {
  loadAll: vi.fn(),
  registerProgrammedTask: vi.fn(),
};
vi.mock('@/services/persisted-data.service', () => ({
  persistedDataService: mockPersistedDataService,
}));

describe('DatabaseService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    MockSequelize.mockClear();
    mockSequelizeInstances.clear();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('memoryDbInstance getter', () => {
    it('throws error when not initialized', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();

      expect(() => service.memoryDbInstance).toThrow(
        'Memory database not initialized. Call DatabaseService.init() first.'
      );
    });
  });

  describe('persistedDbInstance getter', () => {
    it('throws error when not initialized', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();

      expect(() => service.persistedDbInstance).toThrow(
        'Persisted database not available.'
      );
    });
  });

  describe('initMemoryDb', () => {
    it('creates an in-memory SQLite database', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      expect(MockSequelize).toHaveBeenCalledWith(
        expect.objectContaining({
          dialect: 'sqlite',
          storage: ':memory:',
          logging: false,
        })
      );
    });

    it('initializes FuelStationsTable and LastUpdated models', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      expect(mockFuelStationsTable.init).toHaveBeenCalledWith(
        mockFuelStationModel,
        expect.objectContaining({
          modelName: 'FuelStation',
          timestamps: false,
        })
      );
      expect(mockLastUpdated.init).toHaveBeenCalledWith(
        mockLastUpdatedModel,
        expect.objectContaining({
          modelName: 'LastUpdated',
          timestamps: false,
        })
      );
    });

    it('syncs tables with alter option', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      const sqliteCall = MockSequelize.mock.calls.find(
        (call) => call[0]?.dialect === 'sqlite'
      );
      expect(sqliteCall).toBeDefined();
      const instance = mockSequelizeInstances.get(JSON.stringify(sqliteCall?.[0]));
      expect(instance).toBeDefined();
    });

    it('loads realtime data and registers cron task', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();
      await Promise.resolve(); // Allow pending microtasks to settle

      expect(mockRealtimeDataService.loadAll).toHaveBeenCalled();
      expect(mockRealtimeDataService.registerProgrammedTask).toHaveBeenCalled();
    });

    it('returns initialized memoryDbInstance after init', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      const instance = service.memoryDbInstance;
      expect(instance).toBeDefined();
      expect((instance.config as any).dialect).toBe('sqlite');
    });
  });

  describe('initPersistedDb', () => {
    it('skips initialization when validatePostgresDbData returns false', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      // Should not have created a PostgreSQL Sequelize instance
      const pgCall = MockSequelize.mock.calls.find(
        (call) => call[0]?.dialect === 'postgres'
      );
      expect(pgCall).toBeUndefined();
    });
  });

  describe('init', () => {
    it('initializes both memory and persisted DBs in parallel', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      // Memory DB should be initialized
      const sqliteCall = MockSequelize.mock.calls.find(
        (call) => call[0]?.dialect === 'sqlite'
      );
      expect(sqliteCall).toBeDefined();
    });
  });

  describe('databaseService singleton', () => {
    it('exports a singleton instance', async () => {
      const { databaseService } = await import('@/services/database.service');
      const { DatabaseService } = await import('@/services/database.service');

      expect(databaseService).toBeInstanceOf(DatabaseService);
    });
  });
});

// Isolated test suite for PostgreSQL scenarios using vi.resetModules
describe('DatabaseService (PostgreSQL isolated)', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it('creates a PostgreSQL connection when validatePostgresDbData returns true', async () => {
    // Set up environment
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DATABASE = 'testdb';
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';

    // Reset and set up fresh mocks
    vi.resetModules();

    const freshSequelize = vi.fn().mockImplementation(function (config) {
      return {
        config,
        authenticate: vi.fn().mockResolvedValue(undefined),
        sync: vi.fn().mockResolvedValue(undefined),
        query: vi.fn().mockResolvedValue([[{ has_tables: false }]]),
        close: vi.fn().mockResolvedValue(undefined),
      };
    });

    vi.doMock('sequelize', () => ({ Sequelize: freshSequelize }));
    vi.doMock('@/utils/postgres-db/postgres-db', () => ({
      validatePostgresDbData: vi.fn(() => true),
    }));
    vi.doMock('@/utils', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('@/models/db/FuelStations', () => ({
      FuelStationModel: {},
      FuelStationsTable: { init: vi.fn() },
    }));
    vi.doMock('@/models/db/LastUpdated', () => ({
      LastUpdated: { init: vi.fn() },
      LastUpdatedModel: {},
    }));
    vi.doMock('@/models/db/HistoricFuelStation', () => ({
      HistoricFuelStation: { init: vi.fn() },
      HistoricFuelStationModel: {},
    }));
    vi.doMock('@/models/db/HistoricNoData', () => ({
      HistoricNoDataTable: { init: vi.fn() },
      HistoricNoDataModel: {},
    }));
    vi.doMock('@/models/db/Migrations', () => ({
      Migrations: {
        init: vi.fn(),
        sync: vi.fn().mockResolvedValue(undefined),
        bulkCreate: vi.fn().mockResolvedValue([]),
      },
      MigrationsModel: {},
    }));
    vi.doMock('@/services/migration.service', () => ({
      migrationService: {
        isDbEmpty: vi.fn().mockResolvedValue(true),
        run: vi.fn().mockResolvedValue(undefined),
      },
    }));
    vi.doMock('@/migrations', () => ({ MIGRATIONS: [] }));
    vi.doMock('@/services/realtime-data.service', () => ({
      realtimeDataService: { loadAll: vi.fn(), registerProgrammedTask: vi.fn() },
    }));
    vi.doMock('@/services/persisted-data.service', () => ({
      persistedDataService: { loadAll: vi.fn(), registerProgrammedTask: vi.fn() },
    }));
    vi.doMock('@sentry/node', () => ({ captureException: vi.fn() }));

    const { DatabaseService } = await import('@/services/database.service');
    const service = new DatabaseService();
    await service.init();

    // PostgreSQL uses: new Sequelize(database, user, password, { dialect: 'postgres', ... })
    // So dialect is in call[3], not call[0]
    const pgCall = freshSequelize.mock.calls.find(
      (call) => call[3]?.dialect === 'postgres'
    );
    expect(pgCall).toBeDefined();
  });

  it('sets persistedDbInstance to null on authentication failure', async () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DATABASE = 'testdb';
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';

    vi.resetModules();

    const failingSequelize = vi.fn().mockImplementation(function (config) {
      return {
        config,
        authenticate: vi.fn().mockRejectedValue(new Error('Connection refused')),
        sync: vi.fn(),
      };
    });

    vi.doMock('sequelize', () => ({ Sequelize: failingSequelize }));
    vi.doMock('@/utils/postgres-db/postgres-db', () => ({
      validatePostgresDbData: vi.fn(() => true),
    }));
    vi.doMock('@/utils', () => ({
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    }));
    vi.doMock('@/models/db/FuelStations', () => ({
      FuelStationModel: {},
      FuelStationsTable: { init: vi.fn() },
    }));
    vi.doMock('@/models/db/LastUpdated', () => ({
      LastUpdated: { init: vi.fn() },
      LastUpdatedModel: {},
    }));
    vi.doMock('@/models/db/HistoricFuelStation', () => ({
      HistoricFuelStation: { init: vi.fn() },
      HistoricFuelStationModel: {},
    }));
    vi.doMock('@/models/db/HistoricNoData', () => ({
      HistoricNoDataTable: { init: vi.fn() },
      HistoricNoDataModel: {},
    }));
    vi.doMock('@/models/db/Migrations', () => ({
      Migrations: { init: vi.fn(), sync: vi.fn(), bulkCreate: vi.fn() },
      MigrationsModel: {},
    }));
    vi.doMock('@/services/migration.service', () => ({
      migrationService: { isDbEmpty: vi.fn().mockResolvedValue(true), run: vi.fn() },
    }));
    vi.doMock('@/migrations', () => ({ MIGRATIONS: [] }));
    vi.doMock('@/services/realtime-data.service', () => ({
      realtimeDataService: { loadAll: vi.fn(), registerProgrammedTask: vi.fn() },
    }));
    vi.doMock('@/services/persisted-data.service', () => ({
      persistedDataService: { loadAll: vi.fn(), registerProgrammedTask: vi.fn() },
    }));
    vi.doMock('@sentry/node', () => ({ captureException: vi.fn() }));

    const { DatabaseService } = await import('@/services/database.service');
    const service = new DatabaseService();
    await service.init();

    // persistedDbInstance should throw since it was set to null on failure
    expect(() => service.persistedDbInstance).toThrow('Persisted database not available.');
  });
});
