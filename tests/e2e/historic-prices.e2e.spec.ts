import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DateTime } from 'luxon';

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
import { FuelStationsTable } from '@/models/db/FuelStations';
import { HistoricFuelStation } from '@/models/db/HistoricFuelStation';
import { listenApp, closeTestServer, type TestServer } from './setup';

let testServer: TestServer;
let currentRowPk: string;

// FuelStation/HistoricPrice interfaces do not declare `id`, so the seeded
// primary key is set directly (the adapters accept plain row objects).
const fuelRow = () => ({
  id: crypto.randomUUID(),
  stationId: 'ES0001',
  signage: 'REPSOL',
  locality: 'Madrid',
  gasoline95E5Price: 1.65,
});

const historicRow = (date: string, price: number, stationId = 'ES0001') => ({
  id: crypto.randomUUID(),
  stationId,
  stationSignage: 'REPSOL',
  date,
  gasoline95E5Price: price,
});

beforeAll(async () => {
  process.env.API_RESPONSE_LOGGING = 'false';
  // Must be set before the first request: getHistoricDataMaxRangeMonths() caches
  // its parsed result for the lifetime of this module graph.
  process.env.HISTORIC_DATA_MAX_RANGE = '6m';

  FuelStationsTable.init();
  HistoricFuelStation.init();

  testServer = await listenApp(initExpress());
});

beforeEach(async () => {
  await FuelStationsTable.truncate();
  await HistoricFuelStation.truncate();
  await FuelStationsTable.create(fuelRow());
  currentRowPk = ((await FuelStationsTable.findOne())!.dataValues as unknown as { id: string }).id;
  await HistoricFuelStation.bulkCreate([
    historicRow('2024-01-20', 1.6),
    historicRow('2024-01-15', 1.55),
    historicRow('2024-01-15', 1.4, 'ES0002'),
  ]);
});

describe('GET /historic-prices (e2e over real HTTP)', () => {
  it('200 range: seeded rows in ASC date order, camelCase keys, no id field', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-01-31`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({
      stationId: 'ES0001',
      stationSignage: 'REPSOL',
      date: '2024-01-15',
      gasoline95E5Price: 1.55,
    });
    expect(body[1].date).toBe('2024-01-20');
    for (const row of body) {
      expect(Object.keys(row)).not.toContain('id');
    }
  });

  it('200 includeCurrentPrices=true appends the current row with date=today', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-01-31&includeCurrentPrices=true`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body).toHaveLength(3);
    const current = body[2];
    expect(current.date).toBe(DateTime.now().toSQLDate());
    expect(current.id).toBe(currentRowPk);
    expect(current.stationSignage).toBe('REPSOL');
  });

  it('200 empty price: the empty gasoline95E5Price is returned as null, not 0', async () => {
    await HistoricFuelStation.create({
      id: crypto.randomUUID(),
      stationId: 'ES0009',
      stationSignage: 'EMPTY',
      date: '2024-01-10',
      gasoline95E5Price: null,
    });

    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0009&startDate=2024-01-01&endDate=2024-01-31`);

    expect(response.status).toBe(200);
    const body: any = await response.json();
    expect(body).toHaveLength(1);
    expect('gasoline95E5Price' in body[0]).toBe(true);
    expect(body[0].gasoline95E5Price).toBeNull();
  });

  it('400 when id is missing', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?startDate=2024-01-01&endDate=2024-01-31`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when id is repeated', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&id=ES0002&startDate=2024-01-01&endDate=2024-01-31`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(body.error.details)).toContain('Only one id parameter is allowed');
  });

  it('400 on a bad date format', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=01-2024-01&endDate=2024-01-31`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('400 when includeCurrentPrices is not a boolean', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-01-31&includeCurrentPrices=abc`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('400 when the range exceeds HISTORIC_DATA_MAX_RANGE (6m)', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-12-01`);

    expect(response.status).toBe(400);
    const body: any = await response.json();
    expect(body.error).toMatchObject({
      message: 'The maximum difference between the dates cannot be greater than 6 months',
      code: 'BAD_REQUEST',
    });
  });

  it('404 when DISABLE_SERVICE_STATIONS_HISTORIC=true', async () => {
    process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'true';
    try {
      const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-01-31`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
      });
    } finally {
      delete process.env.DISABLE_SERVICE_STATIONS_HISTORIC;
    }
  });
});

afterAll(async () => {
  delete process.env.HISTORIC_DATA_MAX_RANGE;
  await closeTestServer(testServer);
});
