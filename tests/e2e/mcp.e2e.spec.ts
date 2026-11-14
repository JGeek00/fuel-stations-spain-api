import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Sequelize, type CreationAttributes } from 'sequelize';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    banner: vi.fn(),
  },
}));

import { initExpress } from '@/express';
import { McpServerManager } from '@/mcp/manager';
import { FuelStationsTable, FuelStationModel } from '@/models/db/FuelStations';
import type { DatabaseService } from '@/services/database.service';

const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

let server: Server;
let baseUrl: string;
let manager: McpServerManager;
let originalApiResponseLogging: string | undefined;

const CHEAPEST_ID = 'cheapest-station';
const MID_ID = 'mid-station';
const EXPENSIVE_ID = 'expensive-station';

// FuelStation's interface does not declare `id`, so the seeded primary key needs a cast.
const seedRow = (id: string, price: number): CreationAttributes<FuelStationsTable> =>
  ({
    id,
    stationId: id,
    referral: `ref-${id}`,
    signage: 'Repsol',
    address: `Calle Mayor 1 (${id})`,
    municipality: 'Madrid',
    province: 'Madrid',
    latitude: 40.4168,
    longitude: -3.7038,
    locality: 'Madrid',
    gasoline95E5Price: price,
  }) as unknown as CreationAttributes<FuelStationsTable>;

/**
 * Real MCP SDK client connected over Streamable HTTP. `connect()` performs the
 * full initialize handshake (initialize + notifications/initialized) against
 * the server we boot below.
 */
const connectClient = async (): Promise<Client> => {
  const client = new Client({ name: 'e2e-mcp-client', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
  await client.connect(transport);
  return client;
};

const rawRpc = (body: object, sessionId?: string): Promise<Response> =>
  fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  originalApiResponseLogging = process.env.API_RESPONSE_LOGGING;
  process.env.API_RESPONSE_LOGGING = 'false';

  FuelStationsTable.init(FuelStationModel, {
    sequelize,
    modelName: 'FuelStation',
    timestamps: false,
  });
  await sequelize.sync({ force: true });
  await FuelStationsTable.bulkCreate([
    seedRow(CHEAPEST_ID, 1.43),
    seedRow(MID_ID, 1.61),
    seedRow(EXPENSIVE_ID, 1.79),
  ]);

  // find_cheapest_fuel reads the global FuelStationsTable model, not the
  // DatabaseService; the stub only satisfies the constructor's type and any
  // tool touching memoryDbInstance.
  manager = new McpServerManager(
    { memoryDbInstance: sequelize } as unknown as DatabaseService,
    { sessionTimeoutMs: 5000, cleanupIntervalMs: 1000, maxSessions: 5 },
  );

  const app = initExpress(manager);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

describe('MCP streamable HTTP endpoints (e2e over real HTTP)', () => {
  it('completes the initialize handshake over Streamable HTTP', async () => {
    const client = await connectClient();

    expect(client.getServerVersion()?.name).toBe('fuel-stations-spain-mcp');

    await client.close();
  });

  it('tools/list exposes every registered tool', async () => {
    const client = await connectClient();

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name);

    expect(names).toEqual(expect.arrayContaining([
      'query_fuel_stations',
      'search_stations_by_location',
      'get_station_info',
      'query_historic_prices',
      'list_municipalities',
      'compare_fuel_prices',
      'find_cheapest_fuel',
      'get_database_status',
    ]));

    await client.close();
  });

  it('tools/call find_cheapest_fuel returns the seeded cheapest station sorted first', async () => {
    const client = await connectClient();

    const result = await client.callTool({
      name: 'find_cheapest_fuel',
      arguments: { fuelType: 'gasoline95E5Price' },
    });

    expect(result.isError).toBeUndefined();
    const payload = JSON.parse((result.content as Array<{ type: string; text: string }>)[0].text);
    expect(payload.fuelType).toBe('gasoline95E5Price');
    expect(payload.count).toBe(3);
    expect(payload.results.map((r: { id: string }) => r.id)).toEqual([CHEAPEST_ID, MID_ID, EXPENSIVE_ID]);
    expect(payload.results[0].price).toBe(1.43);
    expect(payload.results[0].municipality).toBe('Madrid');

    await client.close();
  });

  it('tools/call with an unknown tool returns an error result', async () => {
    const client = await connectClient();

    const result = await client.callTool({ name: 'no_such_tool', arguments: {} });

    expect(result.isError).toBe(true);
    expect((result.content as Array<{ type: string; text: string }>)[0].text).toMatch(/not found/i);

    await client.close();
  });

  it('GET /mcp without a session id returns 400', async () => {
    const response = await fetch(`${baseUrl}/mcp`);

    expect(response.status).toBe(400);
  });

  it('DELETE closes the session; a later POST with the same session id returns 404', async () => {
    const initResponse = await rawRpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'raw-client', version: '0.0.0' },
      },
    });

    expect(initResponse.status).toBe(200);
    const sessionId = initResponse.headers.get('mcp-session-id');
    expect(sessionId).toBeTruthy();

    const deleteResponse = await fetch(`${baseUrl}/mcp`, {
      method: 'DELETE',
      headers: { 'mcp-session-id': sessionId as string },
    });
    expect(deleteResponse.status).toBe(200);

    const stalePostResponse = await rawRpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      sessionId as string,
    );
    expect(stalePostResponse.status).toBe(404);
  });

  afterAll(async () => {
    await manager.shutdown();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await sequelize.close();
    process.env.API_RESPONSE_LOGGING = originalApiResponseLogging;
  });
});
