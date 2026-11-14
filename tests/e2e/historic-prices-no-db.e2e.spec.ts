import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import { listenApp, closeTestServer, type TestServer } from './setup';

// This file must never initialize HistoricFuelStation: it covers the default
// real-world situation where the historic database is not configured.
let testServer: TestServer;

beforeAll(async () => {
  process.env.API_RESPONSE_LOGGING = 'false';

  testServer = await listenApp(initExpress());
});

describe('GET /historic-prices without a configured historic database (e2e over real HTTP)', () => {
  it('500 with "Database not initialized" when no DB is set up', async () => {
    const response = await fetch(`${testServer.baseUrl}/historic-prices?id=ES0001&startDate=2024-01-01&endDate=2024-01-31`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { message: 'Database not initialized', code: 'INTERNAL_ERROR' },
    });
  });

  it('404 when DISABLE_SERVICE_STATIONS_HISTORIC=true (disabled check runs before the DB middleware)', async () => {
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
  await closeTestServer(testServer);
});
