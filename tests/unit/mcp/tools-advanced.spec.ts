import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock the data seams: legacy municipalities store + historic repository ──
vi.mock('@/repository/Municipalities.repository', () => ({
  default: {
    listAllMunicipalities: vi.fn().mockResolvedValue([]),
    listMunicipalitiesByProvince: vi.fn().mockResolvedValue([]),
    data: [],
  },
}));

vi.mock('@/infrastructure/persistence/HistoricRepository', () => ({
  historicRepository: {
    queryRange: vi.fn(),
    queryCurrent: vi.fn(),
  },
}));

// get_database_status shares the tools index. Its src use case currently has a
// broken merged body (duplicate declarations), so mock the use case seam here
// and test the tool presentation; the src gap is reported to the parent.
vi.mock('@/application/usecases/GetDatabaseStatus.usecase', () => ({
  getDatabaseStatusUseCase: vi.fn(),
}));

vi.mock('@/services/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/utils/case-keys', () => ({
  keysToCamel: vi.fn((obj) => obj),
}));

vi.mock('@/utils/logger', () => ({
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
  listMunicipalitiesTool,
  getDatabaseStatusTool,
  queryHistoricPricesTool,
} from '@/mcp/tools';
import { DatabaseService } from '@/services/database.service';
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';
import { getDatabaseStatusUseCase } from '@/application/usecases/GetDatabaseStatus.usecase';
import { keysToCamel } from '@/utils/case-keys';

// ── Helpers ──────────────────────────────────────────────────────────────────
type McpResponse = { content: Array<{ type: string; text: string }>; isError?: boolean };

function mcpText(result: unknown): string {
  const r = result as McpResponse;
  return r.content?.[0]?.text ?? '';
}

function mcpJson<T = Record<string, unknown>>(result: unknown): T {
  return JSON.parse(mcpText(result)) as T;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('listMunicipalitiesTool', () => {
  const sampleData = [
    { municipalityId: '1', provinceId: '28', regionId: '29', municipality: 'Madrid', province: 'Madrid', region: 'Comunidad de Madrid' },
    { municipalityId: '2', provinceId: '08', regionId: '56', municipality: 'Barcelona', province: 'Barcelona', region: 'Cataluña' },
    { municipalityId: '3', provinceId: '41', regionId: '51', municipality: 'Sevilla', province: 'Sevilla', region: 'Andalucía' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (MunicipalitiesRepository as any).data = sampleData;
  });

  it('exports a function', () => {
    expect(typeof listMunicipalitiesTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const tool = getToolCallback(calls, 'list_municipalities');
    expect(tool.name).toBe('list_municipalities');
    expect(tool.config.title).toBe('List Municipalities');
  });

  it('callback returns all municipalities when no filter', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({});

    const output = mcpJson<{ municipalities: unknown[] }>(result);
    expect(output.municipalities).toHaveLength(3);
  });

  it('callback filters by province', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ province: 'Madrid' });

    const output = mcpJson<{ municipalities: Array<{ municipality: string }> }>(result);
    expect(output.municipalities).toHaveLength(1);
    expect(output.municipalities[0].municipality).toBe('Madrid');
  });

  it('callback filters by province case-insensitive', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ province: 'madrid' });

    const output = mcpJson<{ municipalities: unknown[] }>(result);
    expect(output.municipalities).toHaveLength(1);
  });

  it('callback filters by region', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ region: 'Andalucía' });

    const output = mcpJson<{ municipalities: Array<{ municipality: string }> }>(result);
    expect(output.municipalities).toHaveLength(1);
    expect(output.municipalities[0].municipality).toBe('Sevilla');
  });

  it('callback filters by search with partial match', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ search: 'Bar' });

    const output = mcpJson<{ municipalities: Array<{ municipality: string }> }>(result);
    expect(output.municipalities).toHaveLength(1);
    expect(output.municipalities[0].municipality).toBe('Barcelona');
  });

  it('callback combines province and region filters', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ province: 'Barcelona', region: 'Cataluña' });

    const output = mcpJson<{ municipalities: Array<{ municipality: string }> }>(result);
    expect(output.municipalities).toHaveLength(1);
    expect(output.municipalities[0].municipality).toBe('Barcelona');
  });

  it('callback returns empty when no match', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({ search: 'ZooCity' });

    const output = mcpJson<{ municipalities: unknown[] }>(result);
    expect(output.municipalities).toEqual([]);
  });

  it('callback returns empty array when data is empty', async () => {
    const { instance, calls } = createMockMcpServer();
    (MunicipalitiesRepository as any).data = [];
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({});

    const output = mcpJson<{ municipalities: unknown[] }>(result);
    expect(output.municipalities).toEqual([]);
  });

  it('callback result has municipalities key', async () => {
    const { instance, calls } = createMockMcpServer();
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({});

    const output = mcpJson<Record<string, unknown>>(result);
    expect(output).toHaveProperty('municipalities');
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    // Force an error by making data a getter that throws
    Object.defineProperty(MunicipalitiesRepository, 'data', {
      get: () => { throw new Error('simulated error'); },
      configurable: true,
    });
    listMunicipalitiesTool(instance as never, MunicipalitiesRepository);
    const { callback } = getToolCallback(calls, 'list_municipalities');
    const result = await callback({});

    expect(result).toHaveProperty('isError', true);
  });
});

describe('getDatabaseStatusTool', () => {
  let dbService: DatabaseService;

  const fullStatus = (overrides: Partial<Record<string, unknown>> = {}) => ({
    realtimeDatabase: { status: 'connected', totalStations: 0, lastUpdated: null, ...(overrides.realtimeDatabase as object) },
    historicDatabase: { status: 'connected', ...(overrides.historicDatabase as object) },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    dbService = new DatabaseService();
    (getDatabaseStatusUseCase as Mock).mockResolvedValue(fullStatus());
  });

  it('exports a function', () => {
    expect(typeof getDatabaseStatusTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'get_database_status');
    expect(tool.name).toBe('get_database_status');
    expect(tool.config.title).toBe('Get Database Status');
  });

  it('callback calls the status use case', async () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    await callback();

    expect(getDatabaseStatusUseCase).toHaveBeenCalledTimes(1);
  });

  it('callback returns connected PostgreSQL when the use case reports connected', async () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ historicDatabase: { status: string } }>(result);
    expect(output.historicDatabase.status).toBe('connected');
  });

  it('callback returns disconnected PostgreSQL when the use case reports disconnected', async () => {
    const { instance, calls } = createMockMcpServer();
    (getDatabaseStatusUseCase as Mock).mockResolvedValue(fullStatus({ historicDatabase: { status: 'disconnected' } }));
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ historicDatabase: { status: string } }>(result);
    expect(output.historicDatabase.status).toBe('disconnected');
  });

  it('callback returns SQLite always connected', async () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ realtimeDatabase: { status: string; type: string } }>(result);
    expect(output.realtimeDatabase.status).toBe('connected');
    expect(output.realtimeDatabase.type).toBe('SQLite (in-memory)');
  });

  it('callback returns station count from the use case', async () => {
    const { instance, calls } = createMockMcpServer();
    (getDatabaseStatusUseCase as Mock).mockResolvedValue(fullStatus({ realtimeDatabase: { totalStations: 42 } }));
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ realtimeDatabase: { totalStations: number } }>(result);
    expect(output.realtimeDatabase.totalStations).toBe(42);
  });

  it('callback returns lastUpdated timestamp from the use case', async () => {
    const { instance, calls } = createMockMcpServer();
    (getDatabaseStatusUseCase as Mock).mockResolvedValue(fullStatus({ realtimeDatabase: { lastUpdated: '2025-01-15' } }));
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ realtimeDatabase: { lastUpdated: string } }>(result);
    expect(output.realtimeDatabase.lastUpdated).toBe('2025-01-15');
  });

  it('callback returns null lastUpdated when the use case has no record', async () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ realtimeDatabase: { lastUpdated: unknown } }>(result);
    expect(output.realtimeDatabase.lastUpdated).toBe(null);
  });

  it('callback result has correct structure', async () => {
    const { instance, calls } = createMockMcpServer();
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    const output = mcpJson<{ realtimeDatabase: Record<string, unknown>; historicDatabase: Record<string, unknown> }>(result);
    expect(output).toHaveProperty('realtimeDatabase');
    expect(output).toHaveProperty('historicDatabase');
    expect(output.realtimeDatabase).toHaveProperty('type');
    expect(output.realtimeDatabase).toHaveProperty('status');
    expect(output.realtimeDatabase).toHaveProperty('totalStations');
    expect(output.realtimeDatabase).toHaveProperty('lastUpdated');
    expect(output.historicDatabase).toHaveProperty('type');
    expect(output.historicDatabase).toHaveProperty('status');
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (getDatabaseStatusUseCase as Mock).mockRejectedValue(new Error('DB error'));
    getDatabaseStatusTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'get_database_status');
    const result = await callback();

    expect(result).toHaveProperty('isError', true);
  });
});

describe('queryHistoricPricesTool', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbService = new DatabaseService();
    (historicRepository.queryRange as Mock).mockResolvedValue([]);
    (historicRepository.queryCurrent as Mock).mockResolvedValue(null);
    (keysToCamel as Mock).mockImplementation((obj) => obj);
  });

  it('exports a function', () => {
    expect(typeof queryHistoricPricesTool).toBe('function');
  });

  it('registers tool with correct name and metadata', () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const tool = getToolCallback(calls, 'query_historic_prices');
    expect(tool.name).toBe('query_historic_prices');
    expect(tool.config.title).toBe('Query Historic Prices');
  });

  it('callback returns empty results when no historic data', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    const output = mcpJson<{ stationId: string; count: number; results: unknown[] }>(result);
    expect(output.stationId).toBe('s1');
    expect(output.count).toBe(0);
    expect(output.results).toEqual([]);
  });

  it('callback returns historic results', async () => {
    const { instance, calls } = createMockMcpServer();
    (historicRepository.queryRange as Mock).mockResolvedValue([
      { date: '2025-01-01', gasoilAPrice: 1.5 },
      { date: '2025-01-02', gasoilAPrice: 1.52 },
    ]);
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    const output = mcpJson<{ count: number; results: unknown[] }>(result);
    expect(output.count).toBe(2);
    expect(output.results).toHaveLength(2);
  });

  it('callback queries the historic repository with stationId and date range', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    expect(historicRepository.queryRange).toHaveBeenCalledWith('s1', '2025-01-01', '2025-01-31');
  });

  it('callback validates invalid date format', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: 'not-a-date',
      endDate: '2025-01-31',
    });

    // DateTime.fromSQL('not-a-date') doesn't throw, just returns invalid DateTime
    // The tool proceeds without isError, but produces an empty result
    expect(result).not.toHaveProperty('isError');
    const output = mcpJson<{ count: number }>(result);
    expect(output.count).toBe(0);
  });

  it('callback rejects startDate after endDate', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-12-31',
      endDate: '2025-01-01',
    });

    expect(result).toHaveProperty('isError', true);
    const text = mcpText(result);
    expect(text).toContain('startDate must be earlier');
  });

  it('callback rejects date range over 1 year', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2023-01-01',
      endDate: '2025-01-01',
    });

    expect(result).toHaveProperty('isError', true);
    const text = mcpText(result);
    expect(text).toContain('Maximum date range is 1 year');
  });

  it('callback calls keysToCamel for each historic record', async () => {
    const { instance, calls } = createMockMcpServer();
    (historicRepository.queryRange as Mock).mockResolvedValue([
      { date: '2025-01-01', gasoilA_Price: 1.5 },
    ]);
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    expect(keysToCamel).toHaveBeenCalledTimes(1);
  });

  it('callback includes current prices when includeCurrentPrices is true', async () => {
    const { instance, calls } = createMockMcpServer();
    (historicRepository.queryRange as Mock).mockResolvedValue([
      { date: '2025-01-01', gasoilAPrice: 1.5 },
    ]);
    (historicRepository.queryCurrent as Mock).mockResolvedValue({
      id: 's1',
      signage: 'Brand1',
      gasoilAPrice: 1.55,
    });
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      includeCurrentPrices: true,
    });

    const output = mcpJson<{ count: number }>(result);
    expect(output.count).toBe(2); // 1 historic + 1 current
    expect(historicRepository.queryCurrent).toHaveBeenCalledWith('s1');
  });

  it('callback does not query current prices by default', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    expect(historicRepository.queryCurrent).not.toHaveBeenCalled();
  });

  it('callback result has stationId, startDate, endDate, count, results', async () => {
    const { instance, calls } = createMockMcpServer();
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    const output = mcpJson<{ stationId: string; startDate: string; endDate: string; count: number; results: unknown[] }>(result);
    expect(output).toHaveProperty('stationId');
    expect(output).toHaveProperty('startDate');
    expect(output).toHaveProperty('endDate');
    expect(output).toHaveProperty('count');
    expect(output).toHaveProperty('results');
  });

  it('callback returns isError on failure', async () => {
    const { instance, calls } = createMockMcpServer();
    (historicRepository.queryRange as Mock).mockRejectedValue(new Error('DB error'));
    queryHistoricPricesTool(instance as never, dbService);
    const { callback } = getToolCallback(calls, 'query_historic_prices');
    const result = await callback({
      stationId: 's1',
      startDate: '2025-01-01',
      endDate: '2025-01-31',
    });

    expect(result).toHaveProperty('isError', true);
  });
});
