import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock the data seam: tools → usecases → stationRepository ────────────────
vi.mock('@/infrastructure/persistence/StationRepository', () => ({
  stationRepository: {
    query: vi.fn(),
    findByStationId: vi.fn(),
    findCheapest: vi.fn(),
    compare: vi.fn(),
    searchByLocation: vi.fn(),
  },
}));

// get_database_status shares the tools index; mock its usecase so this file
// only exercises the station-query seam (see tools-advanced for status).
vi.mock('@/application/usecases/GetDatabaseStatus.usecase', () => ({
  getDatabaseStatusUseCase: vi.fn(),
}));

vi.mock('@/infrastructure/database/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/shared/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
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
} from '@/interfaces/mcp/tools';
import { DatabaseService } from '@/infrastructure/database/database.service';
import { stationRepository } from '@/infrastructure/persistence/StationRepository';

// ── Helpers ──────────────────────────────────────────────────────────────────
type McpResponse = { content: Array<{ type: string; text: string }>; isError?: boolean };

function resetRepoMocks() {
  (stationRepository.query as Mock).mockResolvedValue({ rows: [], count: 0 });
  (stationRepository.findByStationId as Mock).mockResolvedValue(null);
  (stationRepository.findCheapest as Mock).mockResolvedValue([]);
  (stationRepository.compare as Mock).mockResolvedValue([]);
  (stationRepository.searchByLocation as Mock).mockResolvedValue([]);
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
    resetRepoMocks();
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

  it('callback returns results for the stations the repository returns', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.compare as Mock).mockResolvedValue([
      {
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoilAPrice: 1.5,
      },
      {
        id: 's2',
        referral: 'Ref2',
        signage: 'Brand2',
        address: 'Addr2',
        municipality: 'Barcelona',
        province: 'Barcelona',
        latitude: 41.4,
        longitude: 2.2,
        gasoilAPrice: 1.4,
      },
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
    (stationRepository.compare as Mock).mockResolvedValue([
      {
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Calle 1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoline95E5Price: 1.6,
      },
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

  it('callback forwards ids filter to the repository', async () => {
    const { instance, calls } = createMockMcpServer();
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', ids: ['s1', 's2'] });

    expect(stationRepository.compare).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      ids: ['s1', 's2'],
      municipalityId: undefined,
      limit: undefined,
    });
  });

  it('callback forwards municipalityId filter to the repository', async () => {
    const { instance, calls } = createMockMcpServer();
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', municipalityId: 42 });

    expect(stationRepository.compare).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      ids: undefined,
      municipalityId: 42,
      limit: undefined,
    });
  });

  it('callback forwards no limit by default (repository applies the 50 default)', async () => {
    const { instance, calls } = createMockMcpServer();
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice' });

    expect(stationRepository.compare).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      ids: undefined,
      municipalityId: undefined,
      limit: undefined,
    });
  });

  it('callback forwards custom limit when provided', async () => {
    const { instance, calls } = createMockMcpServer();
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    await callback({ fuelType: 'gasoilAPrice', limit: 10 });

    expect(stationRepository.compare).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      ids: undefined,
      municipalityId: undefined,
      limit: 10,
    });
  });

  it('callback returns coordinates null when missing', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.compare as Mock).mockResolvedValue([
      {
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: null,
        longitude: null,
        gasoilAPrice: 1.5,
      },
    ]);
    compareFuelPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'compare_fuel_prices');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    const output = mcpJson<{ results: Array<{ coordinates: unknown }> }>(result);
    expect(output.results[0].coordinates).toBeNull();
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.compare as Mock).mockRejectedValue(new Error('DB error'));
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
    resetRepoMocks();
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
    (stationRepository.findCheapest as Mock).mockResolvedValue([
      {
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        gasoilAPrice: 1.4,
      },
    ]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    const output = mcpJson<{ scope: string }>(result);
    expect(output.scope).toBe('national');
  });

  it('callback returns center and radius when coordinates provided', async () => {
    const { instance, calls } = createMockMcpServer();
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7, distanceKm: 20 });

    const output = mcpJson<{ center: { latitude: number; longitude: number }; radiusKm: number }>(result);
    expect(output.center).toEqual({ latitude: 40.4, longitude: -3.7 });
    expect(output.radiusKm).toBe(20);
  });

  it('callback forwards coordinates to the repository', async () => {
    const { instance, calls } = createMockMcpServer();
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7, distanceKm: 25 });

    expect(stationRepository.findCheapest).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      latitude: 40.4,
      longitude: -3.7,
      distanceKm: 25,
      limit: undefined,
    });
  });

  it('callback uses default distance of 30 when coordinates but no distanceKm', async () => {
    const { instance, calls } = createMockMcpServer();
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice', latitude: 40.4, longitude: -3.7 });

    expect(outputRadiusKm(result)).toBe(30);
  });

  it('callback forwards no limit by default (repository applies the 10 default)', async () => {
    const { instance, calls } = createMockMcpServer();
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    await callback({ fuelType: 'gasoilAPrice' });

    expect(stationRepository.findCheapest).toHaveBeenCalledWith({
      fuelType: 'gasoilAPrice',
      latitude: undefined,
      longitude: undefined,
      distanceKm: undefined,
      limit: undefined,
    });
  });

  it('callback returns result with correct price field', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.findCheapest as Mock).mockResolvedValue([
      {
        id: 's1',
        referral: 'Ref1',
        signage: 'Brand1',
        address: 'Addr1',
        municipality: 'Madrid',
        province: 'Madrid',
        latitude: 40.4,
        longitude: -3.7,
        lpgPrice: 0.85,
      },
    ]);
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'lpgPrice' });

    const output = mcpJson<{ results: Array<{ price: number }> }>(result);
    expect(output.results[0].price).toBe(0.85);
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.findCheapest as Mock).mockRejectedValue(new Error('DB error'));
    findCheapestFuelTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'find_cheapest_fuel');
    const result = await callback({ fuelType: 'gasoilAPrice' });

    expect(result).toHaveProperty('isError', true);
  });
});

function outputRadiusKm(result: unknown): number {
  return mcpJson<{ radiusKm: number }>(result).radiusKm;
}

describe('getStationInfoTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetRepoMocks();
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
    (stationRepository.findByStationId as Mock).mockResolvedValue({ id: 's1', signage: 'Brand1', address: 'Calle 1' });
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    const result = await callback({ stationId: 's1' });

    const output = mcpJson<{ id: string; signage: string }>(result);
    expect(output.id).toBe('s1');
    expect(output.signage).toBe('Brand1');
  });

  it('callback queries the repository with the given stationId', async () => {
    const { instance, calls } = createMockMcpServer();
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    await callback({ stationId: 'abc123' });

    expect(stationRepository.findByStationId).toHaveBeenCalledWith('abc123');
  });

  it('callback returns not found when station missing', async () => {
    const { instance, calls } = createMockMcpServer();
    getStationInfoTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_station_info');
    const result = await callback({ stationId: 'nonexistent' });

    expect(result).toHaveProperty('isError', true);
    expect(mcpText(result)).toContain('not found');
  });

  it('callback returns isError on DB error', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.findByStationId as Mock).mockRejectedValue(new Error('DB error'));
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
    resetRepoMocks();
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

  it('callback queries the repository for pagination', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.query as Mock).mockResolvedValue({ rows: [{ id: 's1' }], count: 100 });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({});

    expect(stationRepository.query).toHaveBeenCalledTimes(1);
    const output = mcpJson<{ count: number; results: unknown[] }>(result);
    expect(output.count).toBe(100);
    expect(output.results).toHaveLength(1);
  });

  it('callback uses default limit 30 and offset 0', async () => {
    const { instance, calls } = createMockMcpServer();
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({});

    expect(stationRepository.query).toHaveBeenCalledWith({
      ids: undefined,
      municipalityId: undefined,
      limit: 30,
      offset: 0,
    });
  });

  it('callback filters by ids', async () => {
    const { instance, calls } = createMockMcpServer();
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ ids: ['s1', 's2'] });

    expect(stationRepository.query).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['s1', 's2'] })
    );
  });

  it('callback filters by municipalityId', async () => {
    const { instance, calls } = createMockMcpServer();
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ municipalityId: 10 });

    expect(stationRepository.query).toHaveBeenCalledWith(
      expect.objectContaining({ municipalityId: 10 })
    );
  });

  it('callback filters by provinceId', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.query as Mock).mockResolvedValue({
      rows: [
        { id: 'a', provinceId: 28 },
        { id: 'b', provinceId: 99 },
      ],
      count: 2,
    });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({ provinceId: 28 });

    // Province/region filters scan unfiltered and are applied in the use case.
    expect(stationRepository.query).toHaveBeenCalledWith({ limit: undefined, offset: undefined });
    const output = mcpJson<{ results: Array<{ id: string }> }>(result);
    expect(output.results).toEqual([{ id: 'a', provinceId: 28 }]);
  });

  it('callback filters by regionId', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.query as Mock).mockResolvedValue({
      rows: [
        { id: 'a', regionId: 29 },
        { id: 'b', regionId: 99 },
      ],
      count: 2,
    });
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    const result = await callback({ regionId: 29 });

    expect(stationRepository.query).toHaveBeenCalledWith({ limit: undefined, offset: undefined });
    const output = mcpJson<{ results: Array<{ id: string }> }>(result);
    expect(output.results).toEqual([{ id: 'a', regionId: 29 }]);
  });

  it('callback returns custom limit and offset', async () => {
    const { instance, calls } = createMockMcpServer();
    queryFuelStationsTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_fuel_stations');
    await callback({ limit: 50, offset: 20 });

    expect(stationRepository.query).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 20 })
    );
  });

  it('callback result includes count, limit, offset, results', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.query as Mock).mockResolvedValue({ rows: [{ id: 's1' }], count: 5 });
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
    (stationRepository.query as Mock).mockRejectedValue(new Error('DB error'));
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
    resetRepoMocks();
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

  it('callback forwards center and distance to the repository', async () => {
    const { instance, calls } = createMockMcpServer();
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    await callback({ latitude: 40.4, longitude: -3.7, distanceKm: 20 });

    expect(stationRepository.searchByLocation).toHaveBeenCalledWith(40.4, -3.7, 20);
  });

  it('callback uses default distance 30', async () => {
    const { instance, calls } = createMockMcpServer();
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    await callback({ latitude: 40.4, longitude: -3.7 });

    expect(stationRepository.searchByLocation).toHaveBeenCalledWith(40.4, -3.7, 30);
  });

  it('callback returns center and radius in result', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.searchByLocation as Mock).mockResolvedValue([{ id: 's1' }]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7, distanceKm: 25 });

    const output = mcpJson<{ center: { latitude: number; longitude: number }; radiusKm: number }>(result);
    expect(output.center).toEqual({ latitude: 40.4, longitude: -3.7 });
    expect(output.radiusKm).toBe(25);
  });

  it('callback returns stations with full data', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.searchByLocation as Mock).mockResolvedValue([{ id: 's1', signage: 'Brand1', address: 'Calle 1' }]);
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7 });

    const output = mcpJson<{ results: Array<{ id: string }> }>(result);
    expect(output.results).toHaveLength(1);
    expect(output.results[0].id).toBe('s1');
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (stationRepository.searchByLocation as Mock).mockRejectedValue(new Error('DB error'));
    searchByLocationTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'search_stations_by_location');
    const result = await callback({ latitude: 40.4, longitude: -3.7 });

    expect(result).toHaveProperty('isError', true);
  });
});
