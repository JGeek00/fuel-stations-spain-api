import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-0000'),
}));

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  class McpServer {
    server = { connect: vi.fn() };
    registerTool = vi.fn();
    registerResource = vi.fn();
  }
  return { McpServer };
});

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => {
  class StreamableHTTPServerTransport {
    close = vi.fn().mockResolvedValue(undefined);
    handleRequest = vi.fn().mockResolvedValue(undefined);
  }
  return { StreamableHTTPServerTransport };
});

vi.mock('@/services/database.service', () => {
  class DatabaseService {
    persistedDbInstance = { authenticate: vi.fn().mockResolvedValue(undefined) };
    memoryDbInstance = {};
  }
  return { DatabaseService };
});

vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findStationById: vi.fn(),
    getStationByCif: vi.fn(),
    getStationByNif: vi.fn(),
    getAllStations: vi.fn(),
    getStationByProvinceAndMunicipality: vi.fn(),
    findAll: vi.fn().mockResolvedValue([]),
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

vi.mock('@/repository/Municipalities.repository', () => ({
  default: {
    listAllMunicipalities: vi.fn().mockResolvedValue([]),
    listMunicipalitiesByProvince: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/utils/calculate-distance', () => ({
  calculateBoundingBox: vi.fn().mockReturnValue({
    minLat: 0,
    maxLat: 1,
    minLon: 0,
    maxLon: 1,
  }),
}));

vi.mock('@/utils/case-keys', () => ({
  keysToCamel: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/utils/mcp', () => ({
  parseCsvEnv: vi.fn().mockReturnValue([]),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
import { createMcpServerInstance } from '../server';
import { DatabaseService } from '../../services/database.service';

/**
 * Typed mock server — TypeScript sees the real SDK types for McpServer,
 * but at runtime vi.mock replaces it with our class that has vi.fn() fields.
 * This interface lets us safely access .mock on those fields.
 */
interface MockMcpServer {
  registerTool: Mock;
  registerResource: Mock;
}

function getMockServer() {
  const dbService = new DatabaseService();
  return createMcpServerInstance(dbService) as unknown as MockMcpServer;
}

describe('createMcpServerInstance', () => {
  let dbService: DatabaseService;

  beforeEach(() => {
    vi.clearAllMocks();
    dbService = new DatabaseService();
  });

  it('returns an McpServer instance', () => {
    const instance = createMcpServerInstance(dbService);
    expect(instance).toBeDefined();
    expect(instance.constructor.name).toBe('McpServer');
  });

  it('registers all 8 tools', () => {
    const server = getMockServer();
    const registerTool = server.registerTool;

    const toolNames = registerTool.mock.calls.map((call) => call[0]);
    expect(toolNames).toContain('compare_fuel_prices');
    expect(toolNames).toContain('find_cheapest_fuel');
    expect(toolNames).toContain('get_station_info');
    expect(toolNames).toContain('query_fuel_stations');
    expect(toolNames).toContain('search_stations_by_location');
    expect(toolNames).toContain('list_municipalities');
    expect(toolNames).toContain('get_database_status');
    expect(toolNames).toContain('query_historic_prices');
    expect(registerTool).toHaveBeenCalledTimes(8);
  });

  it('registers all 5 resources', () => {
    const server = getMockServer();
    const registerResource = server.registerResource;

    const resourceNames = registerResource.mock.calls.map((call) => call[0]);
    expect(resourceNames).toContain('fuel-types');
    expect(resourceNames).toContain('historic-schema');
    expect(resourceNames).toContain('stations-schema');
    expect(resourceNames).toContain('database-info');
    expect(resourceNames).toContain('municipalities-list');
    expect(registerResource).toHaveBeenCalledTimes(5);
  });

  it('registers each tool only once', () => {
    const server = getMockServer();
    const toolNames = server.registerTool.mock.calls.map((call) => call[0]);
    const unique = new Set(toolNames);
    expect(unique.size).toBe(toolNames.length);
  });

  it('registers each resource only once', () => {
    const server = getMockServer();
    const resourceNames = server.registerResource.mock.calls.map((call) => call[0]);
    const unique = new Set(resourceNames);
    expect(unique.size).toBe(resourceNames.length);
  });

  it('creates independent instances', () => {
    const s1 = createMcpServerInstance(dbService);
    const s2 = createMcpServerInstance(dbService);
    expect(s1).not.toBe(s2);
  });
});
