import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

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
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import type { Municipality } from '@/models/entities/Municipality.model';
import { listenApp, closeTestServer, type TestServer } from './setup';

let testServer: TestServer;

const seededMunicipalities: Municipality[] = [
  {
    municipalityId: '28079',
    provinceId: '28',
    regionId: '7',
    municipality: 'Madrid',
    province: 'Madrid',
    region: 'Comunidad de Madrid',
  },
  {
    municipalityId: '8902',
    provinceId: '08',
    regionId: '9',
    municipality: 'Badalona',
    province: 'Barcelona',
    region: 'Cataluña',
  },
];

beforeAll(async () => {
  process.env.API_RESPONSE_LOGGING = 'false';

  // MunicipalitiesRepository is a singleton whose `data` array is settable;
  // seeding it directly keeps the response deterministic (no network fetch).
  MunicipalitiesRepository.data = seededMunicipalities;

  testServer = await listenApp(initExpress());
});

describe('GET /municipalities (e2e over real HTTP)', () => {
  it('200 returns the seeded municipalities deterministically', async () => {
    const response = await fetch(`${testServer.baseUrl}/municipalities`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ municipalities: seededMunicipalities });
  });

  it('404 when DISABLE_MUNICIPALITIES=true', async () => {
    process.env.DISABLE_MUNICIPALITIES = 'true';
    try {
      const response = await fetch(`${testServer.baseUrl}/municipalities`);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { message: 'Endpoint not found', code: 'NOT_FOUND' },
      });
    } finally {
      delete process.env.DISABLE_MUNICIPALITIES;
    }
  });
});

afterAll(async () => {
  MunicipalitiesRepository.data = [];
  await closeTestServer(testServer);
});
