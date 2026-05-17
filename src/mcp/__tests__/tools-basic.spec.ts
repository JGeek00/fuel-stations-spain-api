import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock all dependencies ────────────────────────────────────────────────────
vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findStationById: vi.fn(),
    getStationByCif: vi.fn(),
    getStationByNif: vi.fn(),
    getAllStations: vi.fn(),
    getStationByProvinceAndMunicipality: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findAndCountAll: vi.fn().mockResolvedValue({ rows: [], count: 0 }),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/models/db/HistoricFuelStation', () => ({
  HistoricFuelStation: {
    getHistoricPricesForStation: vi.fn(),
    getHistoricPricesForStationInRange: vi.fn(),
    getHistoricPriceForStationAndDate: vi.fn(),
    getHistoricPricesByMunicipality: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: {
    get: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/models/entities/FuelStation.model', () => ({
  FuelStation: {},
}));

vi.mock('@/models/entities/Municipality.model', () => ({
  Municipality: {},
}));

vi.mock('@/services/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/utils/calculate-distance', () => ({
  calculateBoundingBox: vi.fn().mockReturnValue({
    minLat: 39,
    maxLat: 41,
    minLon: -3,
    maxLon: 1,
  }),
}));

vi.mock('@/utils/case-keys', () => ({
  keysToCamel: vi.fn((obj) => obj),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/repository/Municipalities.repository', () => ({
  default: {
    listAllMunicipalities: vi.fn().mockResolvedValue([]),
    listMunicipalitiesByProvince: vi.fn().mockResolvedValue([]),
    data: [],
  },
}));

// ── Mock McpServer that captures tool registrations ─────────────────────────
function createMockMcpServer() {
  const calls: Array<{
    name: string;
    config: { title: string; description: string; inputSchema?: object };
    callback: (args?: Record<string, unknown>) => Promise<unknown>;
  }> = [];

  class McpServerMock {
    server = { connect: vi.fn() };
    registerTool = vi.fn((_name: string, _config: object, _callback: (args?: Record<string, unknown>) => Promise<unknown>) => {
      calls.push({
        name: _name,
        config: _config as { title: string; description: string; inputSchema?: object },
        callback: _callback,
      });
    });
  }

  return { instance: new McpServerMock(), calls };
}

function getToolCallback(calls: ReturnType<typeof createMockMcpServer>['calls'], name: string) {
  const call = calls.find((c) => c.name === name);
  if (!call) throw new Error(`No registerTool call found for '${name}'`);
  return call;
}

// ── Import after mocks ───────────────────────────────────────────────────────
import {
  compareFuelPricesTool,
  findCheapestFuelTool,
  getStationInfoTool,
  queryFuelStationsTool,
  searchByLocationTool,
} from '../tools';
import { DatabaseService } from '../../services/database.service';
import { FuelStationsTable } from '../../models/db/FuelStations';
import { calculateBoundingBox } from '../../utils/calculate-distance';

// ── Helpers ──────────────────────────────────────────────────────────────────
type McpResponse = { content: Array<{ type: string; text: string }>; isError?: boolean };

function createMockStation(data: Record<string, unknown>) {
  return { get: () => data };
}

function resetDbMocks() {
  (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
  (FuelStationsTable.findOne as Mock).mockResolvedValue(null);
  (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
  (FuelStationsTable.count as Mock).mockResolvedValue(0);
}

function mcpText(result: unknown): string {
  const r = result as McpResponse;
  return r.content?.[0]?.text ?? '';
}

function mcpJson<T = Record<string, unknown>>(result: unknown): T {
  return JSON.parse(mcpText(result)) as T;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('compareFuelPricesTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    dbService = new DatabaseService();
  });

  it('exports a function', () => {
    expect(typeof compareFuelPricesTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    compareFuelPricesTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'compare_fuel_prices');
    expect(tool.name).toBe('compare_fuel_prices');
    expect(tool.config.title).toBe('Compare Fuel Prices');
    expect(tool.config.description).toContain('Compare');
  });

  it('callback returns sorted results by fuel price', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoilAPrice: 1.5,
      }),
      createMockStation({
        id: 's2',
        referral: 'Ref2',
        signage: 'Brand2',
        address: 'Addr2',
        municipality: 'Barcelona',
        province: 'Barcelona',
        latitude: 41.4,
        longitude: 2.2,
        gasoilAPrice: 1.4,
      }),
    ]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    const output = mcpJson<{ fuelType: string; count: number; results: unknown[] }>(result);
    expect(output.fuelType).toBe('gasoilAPrice');
    expect(output.count).toBe(2);
    expect(output.results).toHaveLength(2);
  });

  it('callback result has correct structure per station', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Calle 1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoline95E5Price: 1.6,
      }),
    ]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    const result = await callback({ fuelType: 'gasoline95E5Price' });

    const output = mcpJson<{ results: Array<{ price: number }> }>(result);
    const station = output.results[0];
    expect(station).toHaveProperty('id');
    expect(station).toHaveProperty('referral');
    expect(station).toHaveProperty('signage');
    expect(station).toHaveProperty('address');
    expect(station).toHaveProperty('municipality');
    expect(station).toHaveProperty('province');
    expect(station).toHaveProperty('coordinates');
    expect(station).toHaveProperty('price');
    expect(station.price).toBe(1.6);
  });

  it('callback filters by ids when provided', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', ids: ['s1', 's2'] });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: ['s1', 's2'] }) })
    );
  });

  it('callback filters by municipalityId when provided', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', municipalityId: 42 });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ municipalityId: 42 }) })
    );
  });

  it('callback uses default limit of 50', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice' });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });

  it('callback uses custom limit when provided', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', limit: 10 });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  it('callback returns coordinates null when missing', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: null,
        longitude: null,
        gasoilAPrice: 1.5,
      }),
    ]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    const output = mcpJson<{ results: Array<{ coordinates: unknown }> }>(result);
    expect(output.results[0].coordinates).toBeNull();
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockRejectedValue(new Error('DB error'));
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    expect(result).toHaveProperty('isError', true);
  });
});

describe('findCheapestFuelTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    dbService = new DatabaseService();
  });

  it('exports a function', () => {
    expect(typeof findCheapestFuelTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    findCheapestFuelTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'find_cheapest_fuel');
    expect(tool.name).toBe('find_cheapest_fuel');
    expect(tool.config.title).toBe('Find Cheapest Fuel');
  });

  it('callback returns national scope when no coordinates', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoilAPrice: 1.4,
      }),
    ]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    const output = mcpJson<{ scope: string }>(result);
    expect(output.scope).toBe('national');
  });

  it('callback returns center and radius when coordinates provided', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7, distanceKm: 20 });

    const output = mcpJson<{ center: { latitude: number; longitude: number }; radiusKm: number }>(result);
    expect(output.center).toEqual({ latitude: 40.4, longitude: -3.7 });
    expect(output.radiusKm).toBe(20);
  });

  it('callback uses calculateBoundingBox with coordinates', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7, distanceKm: 25 });

    expect(calculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 25);
  });

  it('callback uses default distance of 30 when coordinates but no distanceKm', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7 });

    expect(calculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 30);
  });

  it('callback uses default limit of 10', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    await callback({ fuelType: 'gasoilAPrice' });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10 })
    );
  });

  it('callback returns result with correct price field', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        lpgPrice: 0.85,
      }),
    ]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'lpgPrice' });

    const output = mcpJson<{ results: Array<{ price: number }> }>(result);
    expect(output.results[0].price).toBe(0.85);
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockRejectedValue(new Error('DB error'));
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    expect(result).toHaveProperty('isError', true);
  });
});

describe('getStationInfoTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    dbService = new DatabaseService();
  });

  it('exports a function', () => {
    expect(typeof getStationInfoTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    getStationInfoTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'get_station_info');
    expect(tool.name).toBe('get_station_info');
    expect(tool.config.title).toBe('Get Station Info');
  });

  it('callback returns station data when found', async () => {
    const { instance, calls } = createMockMcpServer();
    const mockData = { id: 's1', signage: 'Brand1', address: 'Calle 1' };
    (FuelStationsTable.findOne as Mock).mockResolvedValue(createMockStation(mockData));
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    const result = await callback({ stationId: 's1' });

    const output = mcpJson<{ id: string; signage: string }>(result);
    expect(output.id).toBe('s1');
    expect(output.signage).toBe('Brand1');
  });

  it('callback calls findOne with correct stationId', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findOne as Mock).mockResolvedValue(null);
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    await callback({ stationId: 'abc123' });

    expect(FuelStationsTable.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { stationId: 'abc123' } })
    );
  });

  it('callback returns not found when station missing', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findOne as Mock).mockResolvedValue(null);
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    const result = await callback({ stationId: 'nonexistent' });

    expect(result).toHaveProperty('isError', true);
    expect(mcpText(result)).toContain('not found');
  });

  it('callback returns isError on DB error', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findOne as Mock).mockRejectedValue(new Error('DB error'));
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    const result = await callback({ stationId: 's1' });

    expect(result).toHaveProperty('isError', true);
  });
});

describe('queryFuelStationsTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    dbService = new DatabaseService();
  });

  it('exports a function', () => {
    expect(typeof queryFuelStationsTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    queryFuelStationsTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'query_fuel_stations');
    expect(tool.name).toBe('query_fuel_stations');
    expect(tool.config.title).toBe('Query Fuel Stations');
  });

  it('callback uses findAndCountAll for pagination', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({
      rows: [createMockStation({ id: 's1' })],
      count: 100,
    });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({});

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledTimes(1);
    const output = mcpJson<{ count: number; results: unknown[] }>(result);
    expect(output.count).toBe(100);
    expect(output.results).toHaveLength(1);
  });

  it('callback uses default limit 30 and offset 0', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({});

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 30, offset: 0 })
    );
  });

  it('callback filters by ids', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ ids: ['s1', 's2'] });

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: ['s1', 's2'] }) })
    );
  });

  it('callback filters by municipalityId', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ municipalityId: 10 });

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ municipalityId: 10 }) })
    );
  });

  it('callback filters by provinceId', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ provinceId: 28 });

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ provinceId: 28 }) })
    );
  });

  it('callback filters by regionId', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ regionId: 29 });

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ regionId: 29 }) })
    );
  });

  it('callback returns custom limit and offset', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({ rows: [], count: 0 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ limit: 50, offset: 20 });

    expect(FuelStationsTable.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 20 })
    );
  });

  it('callback result includes count, limit, offset, results', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockResolvedValue({
      rows: [createMockStation({ id: 's1' })],
      count: 5,
    });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({ limit: 10, offset: 5 });

    const output = mcpJson<{ count: number; limit: number; offset: number; results: unknown[] }>(result);
    expect(output).toHaveProperty('count');
    expect(output).toHaveProperty('limit');
    expect(output).toHaveProperty('offset');
    expect(output).toHaveProperty('results');
    expect(output.limit).toBe(10);
    expect(output.offset).toBe(5);
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAndCountAll as Mock).mockRejectedValue(new Error('DB error'));
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({});

    expect(result).toHaveProperty('isError', true);
  });
});

describe('searchByLocationTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetDbMocks();
    dbService = new DatabaseService();
  });

  it('exports a function', () => {
    expect(typeof searchByLocationTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    searchByLocationTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'search_stations_by_location');
    expect(tool.name).toBe('search_stations_by_location');
    expect(tool.config.title).toBe('Search Stations by Location');
  });

  it('callback calls calculateBoundingBox', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    await callback({ latitude: 40.4, longitude: -3.7, distanceKm: 20 });

    expect(calculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 20);
  });

  it('callback uses default distance 30', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    await callback({ latitude: 40.4, longitude: -3.7 });

    expect(calculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 30);
  });

  it('callback queries with bounding box coordinates', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    await callback({ latitude: 40.4, longitude: -3.7 });

    expect(FuelStationsTable.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          latitude: expect.any(Object),
          longitude: expect.any(Object),
        }),
      })
    );
  });

  it('callback returns center and radius in result', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockResolvedValue([
      createMockStation({ id: 's1' }),
    ]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7, distanceKm: 25 });

    const output = mcpJson<{ center: { latitude: number; longitude: number }; radiusKm: number }>(result);
    expect(output.center).toEqual({ latitude: 40.4, longitude: -3.7 });
    expect(output.radiusKm).toBe(25);
  });

  it('callback returns stations with full data', async () => {
    const { instance, calls } = createMockMcpServer();
    const stationData = { id: 's1', signage: 'Brand1', address: 'Calle 1' };
    (FuelStationsTable.findAll as Mock).mockResolvedValue([createMockStation(stationData)]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7 });

    const output = mcpJson<{ results: Array<{ id: string }> }>(result);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].id).toBe('s1');
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (FuelStationsTable.findAll as Mock).mockRejectedValue(new Error('DB error'));
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7 });

    expect(result).toHaveProperty('isError', true);
  });
});
