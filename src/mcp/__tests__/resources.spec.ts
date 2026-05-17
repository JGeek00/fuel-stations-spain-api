import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock all dependencies shared by resources ────────────────────────────────
vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findAll: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/models/db/HistoricFuelStation', () => ({
  HistoricFuelStation: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: {
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/services/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/repository/Municipalities.repository', () => ({
  default: {
    listAllMunicipalities: vi.fn().mockResolvedValue([]),
    listMunicipalitiesByProvince: vi.fn().mockResolvedValue([]),
    data: [],
  },
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Mock McpServer ───────────────────────────────────────────────────────────
function createMockMcpServer() {
  type ResourceResult = { contents: Array<{ uri: string; mimeType: string; text: string }> };

  const calls: Array<{
    name: string;
    uri: string;
    config: { description: string; mimeType: string };
    readCallback: () => Promise<ResourceResult>;
  }> = [];

  class McpServerMock {
    server = { connect: vi.fn() };
    registerResource = vi.fn((_name: string, _uri: string, _config: object, _callback: () => Promise<ResourceResult>) => {
      calls.push({
        name: _name,
        uri: _uri,
        config: _config as { description: string; mimeType: string },
        readCallback: _callback,
      });
    });
  }

  return { instance: new McpServerMock(), calls };
}

// ── Import after mocks ───────────────────────────────────────────────────────
import {
  registerFuelTypesResource,
  registerHistoricSchemaResource,
  registerStationsSchemaResource,
  registerDatabaseInfoResource,
  registerMunicipalitiesResource,
} from '../resources';
import { DatabaseService } from '../../services/database.service';
import { FuelStationsTable } from '../../models/db/FuelStations';
import { LastUpdated } from '../../models/db/LastUpdated';
import MunicipalitiesRepository from '../../repository/Municipalities.repository';

// ── Helpers ──────────────────────────────────────────────────────────────────
function getReadCallback(calls: ReturnType<typeof createMockMcpServer>['calls'], name: string) {
  const call = calls.find((c) => c.name === name);
  if (!call) throw new Error(`No registerResource call found for '${name}'`);
  return call;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('registerFuelTypesResource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports a function', () => {
    expect(typeof registerFuelTypesResource).toBe('function');
  });

  it('registers resource with correct name and URI', () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const call = getReadCallback(calls, 'fuel-types');
    expect(call.name).toBe('fuel-types');
    expect(call.uri).toBe('fuelstations://info/fuel-types');
  });

  it('registers with correct metadata', () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const call = getReadCallback(calls, 'fuel-types');
    expect(call.config.mimeType).toBe('application/json');
    expect(call.config.description).toContain('fuel types');
  });

  it('readCallback returns 23 fuel types', async () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'fuel-types');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data).toHaveLength(23);
  });

  it('readCallback returns correct URI and mimeType', async () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'fuel-types');
    const result = await readCallback();

    expect(result.contents[0].uri).toBe('fuelstations://info/fuel-types');
    expect(result.contents[0].mimeType).toBe('application/json');
  });

  it('readCallback returns fuel types with field, name, commonName, unit', async () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'fuel-types');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    const first = data[0];
    expect(first).toHaveProperty('field');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('commonName');
    expect(first).toHaveProperty('unit');
  });

  it('includes specific fuel types: gasoilA, gasoline95E5, lpg', async () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'fuel-types');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    const fields = data.map((t: { field: string }) => t.field);
    expect(fields).toContain('gasoilAPrice');
    expect(fields).toContain('gasoline95E5Price');
    expect(fields).toContain('lpgPrice');
  });

  it('readCallback output is valid pretty-printed JSON', async () => {
    const { instance, calls } = createMockMcpServer();
    registerFuelTypesResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'fuel-types');
    const result = await readCallback();

    const text = result.contents[0].text;
    expect(text).toContain('\n'); // pretty-printed with indentation
    expect(() => JSON.parse(text)).not.toThrow();
  });
});

describe('registerHistoricSchemaResource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports a function', () => {
    expect(typeof registerHistoricSchemaResource).toBe('function');
  });

  it('registers resource with correct name and URI', () => {
    const { instance, calls } = createMockMcpServer();
    registerHistoricSchemaResource(instance as never);
    const call = getReadCallback(calls, 'historic-schema');
    expect(call.name).toBe('historic-schema');
    expect(call.uri).toBe('fuelstations://schema/historic');
  });

  it('readCallback returns schema with table info', async () => {
    const { instance, calls } = createMockMcpServer();
    registerHistoricSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'historic-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.table).toBe('HistoricFuelStation');
    expect(data.database).toBe('PostgreSQL');
  });

  it('readCallback returns schema with all expected fields', async () => {
    const { instance, calls } = createMockMcpServer();
    registerHistoricSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'historic-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields).toBeDefined();
    expect(data.fields.id).toBeDefined();
    expect(data.fields.stationId).toBeDefined();
    expect(data.fields.stationSignage).toBeDefined();
    expect(data.fields.date).toBeDefined();
    expect(data.fields.gasoilAPrice).toBeDefined();
    expect(data.fields.gasoline95E5Price).toBeDefined();
    expect(data.fields.hydrogenPrice).toBeDefined();
  });

  it('readCallback returns field types correctly', async () => {
    const { instance, calls } = createMockMcpServer();
    registerHistoricSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'historic-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.id.type).toBe('uuid');
    expect(data.fields.stationId.type).toBe('string');
    expect(data.fields.date.type).toBe('date');
    expect(data.fields.gasoilAPrice.type).toBe('number');
  });

  it('readCallback returns notes array', async () => {
    const { instance, calls } = createMockMcpServer();
    registerHistoricSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'historic-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(Array.isArray(data.notes)).toBe(true);
    expect(data.notes.length).toBeGreaterThan(0);
  });
});

describe('registerStationsSchemaResource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports a function', () => {
    expect(typeof registerStationsSchemaResource).toBe('function');
  });

  it('registers resource with correct name and URI', () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const call = getReadCallback(calls, 'stations-schema');
    expect(call.name).toBe('stations-schema');
    expect(call.uri).toBe('fuelstations://schema/stations');
  });

  it('readCallback returns schema with table info', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.table).toBe('FuelStation');
    expect(data.database).toBe('SQLite (in-memory)');
  });

  it('readCallback returns schema with geographic fields', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.latitude).toBeDefined();
    expect(data.fields.longitude).toBeDefined();
    expect(data.fields.postalCode).toBeDefined();
    expect(data.fields.address).toBeDefined();
    expect(data.fields.province).toBeDefined();
    expect(data.fields.municipality).toBeDefined();
  });

  it('readCallback returns schema with fuel price fields', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.gasoilAPrice).toBeDefined();
    expect(data.fields.gasoline95E5Price).toBeDefined();
    expect(data.fields.lpgPrice).toBeDefined();
    expect(data.fields.hydrogenPrice).toBeDefined();
  });

  it('readCallback returns all field types as number for prices', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.gasoilAPrice.type).toBe('number');
    expect(data.fields.gasoline95E5Price.type).toBe('number');
    expect(data.fields.lpgPrice.type).toBe('number');
  });

  it('readCallback returns field types as string for text fields', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.id.type).toBe('string');
    expect(data.fields.address.type).toBe('string');
    expect(data.fields.province.type).toBe('string');
  });

  it('readCallback returns field types as number for IDs', async () => {
    const { instance, calls } = createMockMcpServer();
    registerStationsSchemaResource(instance as never);
    const { readCallback } = getReadCallback(calls, 'stations-schema');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.fields.municipalityId.type).toBe('number');
    expect(data.fields.provinceId.type).toBe('number');
    expect(data.fields.regionId.type).toBe('number');
  });
});

describe('registerDatabaseInfoResource', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbService = new DatabaseService();
    // Reset mocks to defaults
    (FuelStationsTable.count as Mock).mockResolvedValue(0);
    (LastUpdated.findOne as Mock).mockResolvedValue(null);
    (dbService.persistedDbInstance.authenticate as Mock).mockResolvedValue(undefined);
  });

  it('exports a function', () => {
    expect(typeof registerDatabaseInfoResource).toBe('function');
  });

  it('registers resource with correct name and URI', () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const call = getReadCallback(calls, 'database-info');
    expect(call.name).toBe('database-info');
    expect(call.uri).toBe('fuelstations://info/status');
  });

  it('registers with correct metadata', () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const call = getReadCallback(calls, 'database-info');
    expect(call.config.mimeType).toBe('application/json');
    expect(call.config.description).toContain('status');
  });

  it('readCallback returns connected status when PostgreSQL authenticates', async () => {
    const { instance, calls } = createMockMcpServer();
    (dbService.persistedDbInstance.authenticate as Mock).mockResolvedValue(undefined);
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.historicDatabase.status).toBe('connected');
  });

  it('readCallback returns disconnected status when PostgreSQL fails', async () => {
    const { instance, calls } = createMockMcpServer();
    (dbService.persistedDbInstance.authenticate as Mock).mockRejectedValue(new Error('connection refused'));
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.historicDatabase.status).toBe('disconnected');
  });

  it('readCallback returns SQLite status as connected', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.realtimeDatabase.status).toBe('connected');
    expect(data.realtimeDatabase.type).toBe('SQLite (in-memory)');
  });

  it('readCallback returns PostgreSQL type', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.historicDatabase.type).toBe('PostgreSQL');
  });

  it('readCallback calls FuelStationsTable.count()', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    await readCallback();

    expect(FuelStationsTable.count).toHaveBeenCalledTimes(1);
  });

  it('readCallback calls LastUpdated.findOne()', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    await readCallback();

    expect(LastUpdated.findOne).toHaveBeenCalledTimes(1);
  });

  it('readCallback calls databaseService.authenticate()', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    await readCallback();

    expect(dbService.persistedDbInstance.authenticate).toHaveBeenCalledTimes(1);
  });

  it('readCallback returns station count from FuelStationsTable', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.count as Mock).mockResolvedValue(42);
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.realtimeDatabase.totalStations).toBe(42);
  });

  it('readCallback returns lastUpdated from LastUpdated model', async () => {
    const { instance, calls } = createMockMcpServer();
    const mockLastUpdated = { getDataValue: vi.fn().mockReturnValue('2025-01-15') };
    (LastUpdated.findOne as Mock).mockResolvedValue(mockLastUpdated);
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.realtimeDatabase.lastUpdated).toBe('2025-01-15');
    expect(mockLastUpdated.getDataValue).toHaveBeenCalledWith('lastUpdated');
  });

  it('readCallback returns null lastUpdated when LastUpdated.findOne returns null', async () => {
    const { instance, calls } = createMockMcpServer();
    (LastUpdated.findOne as Mock).mockResolvedValue(null);
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.realtimeDatabase.lastUpdated).toBe(null);
  });

  it('readCallback returns correct URI and mimeType', async () => {
    const { instance, calls } = createMockMcpServer();
    registerDatabaseInfoResource(instance as never, dbService);
    const { readCallback } = getReadCallback(calls, 'database-info');
    const result = await readCallback();

    expect(result.contents[0].uri).toBe('fuelstations://info/status');
    expect(result.contents[0].mimeType).toBe('application/json');
  });
});

describe('registerMunicipalitiesResource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports a function', () => {
    expect(typeof registerMunicipalitiesResource).toBe('function');
  });

  it('registers resource with correct name and URI', () => {
    const { instance, calls } = createMockMcpServer();
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const call = getReadCallback(calls, 'municipalities-list');
    expect(call.name).toBe('municipalities-list');
    expect(call.uri).toBe('fuelstations://municipalities/all');
  });

  it('registers with correct metadata', () => {
    const { instance, calls } = createMockMcpServer();
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const call = getReadCallback(calls, 'municipalities-list');
    expect(call.config.mimeType).toBe('application/json');
    expect(call.config.description).toContain('municipalities');
  });

  it('readCallback returns empty municipalities when data is empty', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [];
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const { readCallback } = getReadCallback(calls, 'municipalities-list');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.count).toBe(0);
    expect(data.municipalities).toEqual([]);
  });

  it('readCallback returns municipalities with count', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [
      { id: 1, name: 'Madrid' },
      { id: 2, name: 'Barcelona' },
    ];
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const { readCallback } = getReadCallback(calls, 'municipalities-list');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data.count).toBe(2);
    expect(data.municipalities).toHaveLength(2);
  });

  it('readCallback returns correct structure with count and municipalities keys', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [{ id: 1 }];
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const { readCallback } = getReadCallback(calls, 'municipalities-list');
    const result = await readCallback();

    const data = JSON.parse(result.contents[0].text);
    expect(data).toHaveProperty('count');
    expect(data).toHaveProperty('municipalities');
  });

  it('readCallback returns correct URI and mimeType', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [];
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const { readCallback } = getReadCallback(calls, 'municipalities-list');
    const result = await readCallback();

    expect(result.contents[0].uri).toBe('fuelstations://municipalities/all');
    expect(result.contents[0].mimeType).toBe('application/json');
  });

  it('readCallback output is valid pretty-printed JSON', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [{ id: 1 }];
    registerMunicipalitiesResource(instance as never, MunicipalitiesRepository);
    const { readCallback } = getReadCallback(calls, 'municipalities-list');
    const result = await readCallback();

    const text = result.contents[0].text;
    expect(text).toContain('\n');
    expect(() => JSON.parse(text)).not.toThrow();
  });
});
