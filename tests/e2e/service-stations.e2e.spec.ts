import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    banner: vi.fn(),
  },
}));

import { initExpress } from '@/express';
import { ensureMemorySchema } from '@/infrastructure/persistence/ensureMemorySchema';
import { fuelStationsTable, getMemoryDb, lastUpdatedTable } from '@/infrastructure/persistence/memory-db';
import { listenApp, closeTestServer, type TestServer } from './setup';

let testServer: TestServer;

// FuelStation's interface does not declare `id`, so the seeded primary key is
// set directly (the adapter accepts a plain row object).
const seedRow = (stationId: string, latitude: number, longitude: number, municipalityId: number) => ({
  id: crypto.randomUUID(),
  stationId,
  latitude,
  longitude,
  municipalityId,
  locality: 'Madrid',
});

const seedStations = () => getMemoryDb().insert(fuelStationsTable).values([
  seedRow('ES0001', 40.4268, -3.6038, 28079),
  seedRow('ES0002', 40.5168, -2.5, 28999),
  seedRow('ES0003', 41.5, -3.7038, 28079),
]);

// GetFuelStationsResponse.results: FuelStation[] — every contract field, with
// the raw stationId replaced by the mapped id key.
const contractResultKeys = [
  'id',
  'postalCode', 'address', 'openingHours', 'latitude', 'longitude', 'locality',
  'margin', 'municipality', 'province', 'referral', 'signage', 'saleType',
  'percBioEthanol', 'percMethylEster', 'municipalityId', 'provinceId', 'regionId',
  'ammoniaPrice', 'biodieselPrice', 'bioethanolPrice', 'compressedBiogasPrice',
  'liquefiedBiogasPrice', 'renewableDieselPrice', 'cngPrice', 'lngPrice',
  'lpgPrice', 'gasoilAPrice', 'gasoilBPrice', 'premiumGasoilPrice',
  'gasoline95E10Price', 'gasoline95E25Price', 'gasoline95E5Price',
  'gasoline95E5PremiumPrice', 'gasoline95E85Price', 'gasoline98E10Price',
  'gasoline98E5Price', 'renewableGasolinePrice', 'hydrogenPrice',
  'methanolPrice', 'adbluePrice',
];

beforeAll(async () => {
  process.env.API_RESPONSE_LOGGING = 'false';

  ensureMemorySchema();

  testServer = await listenApp(initExpress());
});

beforeEach(async () => {
  await getMemoryDb().delete(fuelStationsTable);
  await getMemoryDb().delete(lastUpdatedTable);
  await seedStations();
  // The service stores lastUpdated as an ISO string (SQLite has no DATE type).
  await getMemoryDb().insert(lastUpdatedTable).values({ lastUpdated: '2024-06-01T10:00:00.000Z' });
});

describe('GET /service-stations (e2e over real HTTP)', () => {
  it('200 default: shape {lastUpdated, count, results[]} with stationId mapped to id', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(Object.keys(body)).toEqual(['lastUpdated', 'count', 'results']);
    expect(body.lastUpdated).toBe('2024-06-01T10:00:00.000Z');
    expect(body.count).toBe(3);
    expect(body.results).toHaveLength(3);
    for (const result of body.results) {
      // stationId is mapped to id and the raw stationId key is dropped.
      expect(Object.keys(result)).not.toContain('stationId');
      expect(result.id).toEqual(expect.any(String));
    }
    const ids = body.results.map((r: { id: string }) => r.id).sort();
    expect(ids).toEqual(['ES0001', 'ES0002', 'ES0003']);
    // Full contract shape: every GetFuelStationsResponse/FuelStation key is
    // present (null for unseeded columns), with stationId mapped to id.
    expect([...Object.keys(body.results[0])].sort()).toEqual([...contractResultKeys].sort());
  });

  it('200 with limit and offset', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?limit=2&offset=1`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.count).toBe(3);
    expect(body.results).toHaveLength(2);
    const ids = body.results.map((r: { id: string }) => r.id).sort();
    expect(ids).toEqual(['ES0002', 'ES0003']);
  });

  it('400 when offset >= limit', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?limit=2&offset=2`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error).toMatchObject({ message: 'Offset must be lower than limit', code: 'BAD_REQUEST' });
  });

  it('400 when limit is not an int', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?limit=abc`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('400 when coordinates are missing longitude', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?coordinates=40.4168`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when latitude is out of range', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?coordinates=91.0,-3.7038`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when distance is not an int', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?distance=abc`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when distance is sent without coordinates', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?distance=10`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error).toMatchObject({
      message: 'If the distance parameter is defined, the coordinates parameter is also required',
      code: 'VALIDATION_ERROR',
    });
  });

  it('200 filtering by a single id', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?id=ES0002`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.count).toBe(1);
    expect(body.results).toHaveLength(1);
    expect(body.results[0].id).toBe('ES0002');
  });

  it('200 filtering by repeated ?id= parameters', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?id=ES0001&id=ES0003`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.count).toBe(2);
    const ids = body.results.map((r: { id: string }) => r.id).sort();
    expect(ids).toEqual(['ES0001', 'ES0003']);
  });

  it('200 filtering by municipalityId', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?municipalityId=28999`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.count).toBe(1);
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(['ES0002']);
  });

  it('200 geo filter: only the station inside the bounding box is returned', async () => {
    const response = await fetch(`${testServer.baseUrl}/service-stations?coordinates=40.4168,-3.7038&distance=50`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body.count).toBe(1);
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(['ES0001']);
  });

  it('404 when DISABLE_SERVICE_STATIONS=true', async () => {
    process.env.DISABLE_SERVICE_STATIONS = 'true';
    try {
      const response = await fetch(`${testServer.baseUrl}/service-stations`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
      });
    } finally {
      delete process.env.DISABLE_SERVICE_STATIONS;
    }
  });

  it('500 when the LastUpdated table is empty', async () => {
    await getMemoryDb().delete(lastUpdatedTable);

    const response = await fetch(`${testServer.baseUrl}/service-stations`);

    expect(response.status).toBe(500);
    const body: any = await response.json();
    expect(body.error).toMatchObject({ message: 'Internal server error', code: 'INTERNAL_ERROR' });
  });
});

afterAll(async () => {
  await closeTestServer(testServer);
});
