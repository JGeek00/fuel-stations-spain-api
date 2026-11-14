import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sequelize, type CreationAttributes } from 'sequelize';
import type { Server } from 'node:http';

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
import { FuelStationsTable, FuelStationModel } from '@/models/db/FuelStations';

const sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });

let server: Server;
let baseUrl: string;

// FuelStation's interface does not declare `id`, so the seeded primary key needs a cast.
const seedRow = (): CreationAttributes<FuelStationsTable> =>
  ({
    id: crypto.randomUUID(),
    stationId: 'ES0001',
    locality: 'Madrid',
  }) as unknown as CreationAttributes<FuelStationsTable>;

beforeAll(async () => {
  process.env.API_RESPONSE_LOGGING = 'false';

  FuelStationsTable.init(FuelStationModel, {
    sequelize,
    modelName: 'FuelStation',
    timestamps: false,
  });
  await sequelize.sync({ force: true });

  const app = initExpress();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

beforeEach(async () => {
  await FuelStationsTable.truncate();
  await FuelStationsTable.bulkCreate([seedRow()]);
});

describe('health endpoints (e2e over real HTTP)', () => {
  it('GET /healthcheck returns 200 with seeded rows', async () => {
    const response = await fetch(`${baseUrl}/healthcheck`);

    expect(response.status).toBe(200);
  });

  it('GET /healthcheck returns 500 when the table is empty', async () => {
    await FuelStationsTable.truncate();

    const response = await fetch(`${baseUrl}/healthcheck`);

    expect(response.status).toBe(500);
  });

  it('GET /no-such-route returns 404 with a NOT_FOUND JSON body', async () => {
    const response = await fetch(`${baseUrl}/no-such-route`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
    await sequelize.close();
  });
});
