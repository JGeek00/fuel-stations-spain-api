import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    banner: vi.fn(),
  },
}));

import { healthcheckController } from '@/controllers/healthcheck.controller';
import { FuelStationsTable } from '@/models/db/FuelStations';

const next: NextFunction = () => {};

// FuelStation's interface does not declare `id`, so the seeded primary key is
// set directly (the adapter accepts a plain row object).
const seedRow = () => ({
  id: crypto.randomUUID(),
  stationId: 'ES0001',
  locality: 'Madrid',
});

const createMockRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis();
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

const seed = () => FuelStationsTable.bulkCreate([seedRow()]);

describe('healthcheckController (integration, real in-memory sqlite)', () => {
  beforeAll(async () => {
    FuelStationsTable.init();
  });

  beforeEach(async () => {
    await FuelStationsTable.truncate();
  });

  it('returns 200 when the table has rows', async () => {
    await seed();
    const res = createMockRes();

    await healthcheckController({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalled();
  });

  it('returns 500 when the table is empty', async () => {
    const res = createMockRes();

    await healthcheckController({} as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalled();
  });
});
