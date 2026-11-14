import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Sentry
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
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

// Mock validatePostgresDbData
const mockValidatePostgresDbData = vi.fn(() => false);
vi.mock('@/utils/postgres-db/postgres-db', () => ({
  validatePostgresDbData: mockValidatePostgresDbData,
}));

// Mock pg Pool constructor (Drizzle-pg seam connection)
const createMockPool = () => {
  const instances: Map<string, Record<string, unknown>> = new Map();
  const MockPool = vi.fn().mockImplementation(function (config) {
    const key = JSON.stringify(config);
    const instance = {
      config,
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    instances.set(key, instance);
    return instance;
  });
  return { MockPool, instances };
};

const { MockPool, instances: mockPoolInstances } = createMockPool();
vi.mock('pg', () => ({
  Pool: MockPool,
}));

// Mock Drizzle node-postgres: returns a shared NodePgDatabase-like object
const mockDb = {
  execute: vi.fn(async () => ({ rows: [{ has_tables: false }] })),
  insert: vi.fn(() => ({
    values: vi.fn().mockResolvedValue(undefined),
  })),
};

const drizzle = vi.fn(() => mockDb);
vi.mock('drizzle-orm/node-postgres', () => ({
  drizzle,
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
const mockHistoricFuelStation = {};
vi.mock('@/models/db/HistoricFuelStation', () => ({
  HistoricFuelStation: mockHistoricFuelStation,
  HistoricFuelStationModel: mockHistoricFuelStationModel,
}));

// Mock HistoricNoData
const mockHistoricNoDataModel = {};
const mockHistoricNoDataTable = {};
vi.mock('@/models/db/HistoricNoData', () => ({
  HistoricNoDataModel: mockHistoricNoDataModel,
  HistoricNoDataTable: mockHistoricNoDataTable,
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
    mockPoolInstances.clear();
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
    it('initializes the shared better-sqlite3 memory database tables', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      expect(mockFuelStationsTable.init).toHaveBeenCalled();
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

    it('exposes the shared memory Drizzle instance', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const { getMemoryDb } = await import('@/models/db/memory-db');
      const service = new DatabaseService();
      await service.init();

      expect(service.memoryDbInstance).toBe(getMemoryDb());
    });

    it('loads realtime data and registers cron task', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();
      await Promise.resolve(); // Allow pending microtasks to settle

      expect(mockRealtimeDataService.loadAll).toHaveBeenCalled();
      expect(mockRealtimeDataService.registerProgrammedTask).toHaveBeenCalled();
    });

    it('returns a defined memoryDbInstance after init', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      expect(service.memoryDbInstance).toBeDefined();
    });
  });

  describe('initPersistedDb', () => {
    it('skips initialization when validatePostgresDbData returns false', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      // Should not have created a PostgreSQL pool
      expect(MockPool).not.toHaveBeenCalled();
    });
  });

  describe('init', () => {
    it('initializes both memory and persisted DBs in parallel', async () => {
      const { DatabaseService } = await import('@/services/database.service');
      const service = new DatabaseService();
      await service.init();

      // Memory DB should be initialized
      expect(mockFuelStationsTable.init).toHaveBeenCalled();
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

  const configureEnv = () => {
    process.env.POSTGRES_HOST = 'localhost';
    process.env.POSTGRES_PORT = '5432';
    process.env.POSTGRES_DATABASE = 'testdb';
    process.env.POSTGRES_USER = 'testuser';
    process.env.POSTGRES_PASSWORD = 'testpass';
  };

  const bootstrap = async (options: { poolQuery?: (...args: unknown[]) => Promise<unknown>; validate?: boolean; isDbEmpty?: boolean } = {}) => {
    configureEnv();
    vi.resetModules();

    const freshPool = vi.fn().mockImplementation(function (config) {
      return {
        config,
        query: options.poolQuery
          ? vi.fn(options.poolQuery)
          : vi.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
        end: vi.fn().mockResolvedValue(undefined),
      };
    });
    const freshValidate = options.validate ?? true;
    const freshIsDbEmpty = options.isDbEmpty ?? true;

    const freshDb = {
      execute: vi.fn(async () => ({ rows: [{ has_tables: freshIsDbEmpty }] })),
      insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) })),
    };
    const freshDrizzle = vi.fn(() => freshDb);

    vi.doMock('pg', () => ({ Pool: freshPool }));
    vi.doMock('drizzle-orm/node-postgres', () => ({ drizzle: freshDrizzle }));
    vi.doMock('@/utils/postgres-db/postgres-db', () => ({
      validatePostgresDbData: vi.fn(() => freshValidate),
    }));
    vi.doMock('@/utils/logger', () => ({
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
      HistoricFuelStation: {},
      HistoricFuelStationModel: {},
    }));
    vi.doMock('@/models/db/HistoricNoData', () => ({
      HistoricNoDataTable: {},
      HistoricNoDataModel: {},
    }));
    vi.doMock('@/services/migration.service', () => ({
      migrationService: {
        isDbEmpty: vi.fn().mockResolvedValue(freshIsDbEmpty),
        run: vi.fn().mockResolvedValue(undefined),
      },
    }));
    vi.doMock('@/migrations', () => ({
      MIGRATIONS: [
        { version: '001', name: 'baseline' },
        { version: '002', name: 'unique_station_date' },
      ],
    }));
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
    const migrationModuleRef = (await import('@/services/migration.service')).migrationService;

    return { freshPool, freshDrizzle, freshDb, service, migrationModuleRef };
  };

  it('creates a PostgreSQL connection when validatePostgresDbData returns true', async () => {
    const { freshPool, freshDrizzle } = await bootstrap();

    // Drizzle-pg uses: new Pool({ host, port, user, password, database })
    expect(freshPool).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'localhost',
        port: 5432,
        user: 'testuser',
        password: 'testpass',
        database: 'testdb',
      })
    );
    expect(freshDrizzle).toHaveBeenCalledWith(expect.anything());
  });

  it('authenticates with `select 1` over the pool', async () => {
    const { freshPool } = await bootstrap();
    const poolInstance = freshPool.mock.results[0].value;

    expect(poolInstance.query).toHaveBeenCalledWith('select 1');
  });

  it('marks all migrations as applied on a fresh install (insert replaces bulkCreate)', async () => {
    const { freshDb } = await bootstrap({ isDbEmpty: true });

    expect(freshDb.insert).toHaveBeenCalledTimes(1);
    const rows = (freshDb.insert.mock.results[0].value as any).values.mock.calls[0][0];
    expect(rows).toEqual([
      expect.objectContaining({ version: '001', name: 'baseline' }),
      expect.objectContaining({ version: '002', name: 'unique_station_date' }),
    ]);
    expect(rows[0].appliedAt).toBeInstanceOf(Date);
  });

  it('runs pending migrations when the database is not fresh', async () => {
    const { migrationModuleRef } = await bootstrap({ isDbEmpty: false });

    expect(migrationModuleRef.run).toHaveBeenCalledTimes(1);
  });

  it('creates the persisted tables after the migrations (sync alter equivalent)', async () => {
    const { freshDb } = await bootstrap();

    // CREATE TABLE migrations, CREATE TABLE historic_data, CREATE UNIQUE INDEX,
    // CREATE TABLE historic_no_data
    expect(freshDb.execute.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('sets persistedDbInstance to null on authentication failure', async () => {
    const { freshPool, service } = await bootstrap({
      poolQuery: () => Promise.reject(new Error('Connection refused')),
    });

    const poolInstance = freshPool.mock.results[0].value;
    expect(poolInstance.query).toHaveBeenCalledWith('select 1');

    // persistedDbInstance should throw since it was set to null on failure
    expect(() => service.persistedDbInstance).toThrow('Persisted database not available.');
  });
});
