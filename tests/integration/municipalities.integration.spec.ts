import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// The typia transform does not run under vitest (esbuild), so the runtime
// module cannot assert — same treatment as tests/unit/services/data-provider-api.service.spec.ts
vi.mock('typia', () => ({
  default: {
    assert: vi.fn((value: unknown) => value),
  },
}));

import { realtimeDataService } from '@/services/realtime-data.service';
import { municipalitiesController } from '@/controllers/municipalities.controller';
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import { logger } from '@/utils/logger';
import { municipalitiesResponse, stubProviderFetch } from './helpers';

const next: NextFunction = () => {};

const createMockRes = (): Response => {
  const res = {} as Response;
  res.status = vi.fn().mockReturnThis();
  res.send = vi.fn().mockReturnValue(res);
  return res;
};

describe('MunicipalitiesRepository (integration, real service + controller)', () => {
  beforeEach(() => {
    MunicipalitiesRepository.data = [];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    MunicipalitiesRepository.data = [];
  });

  it('is populated by realtimeDataService.loadMunicipalities with renamed keys', async () => {
    stubProviderFetch({ municipalities: municipalitiesResponse() });

    await realtimeDataService.loadMunicipalities();

    expect(MunicipalitiesRepository.data).toEqual([
      {
        municipalityId: '28079',
        provinceId: '28',
        regionId: '29',
        municipality: 'Madrid',
        province: 'MADRID',
        region: 'Madrid',
      },
    ]);
  });

  it('stays untouched when the provider fetch fails', async () => {
    const previous = [{ municipalityId: '1', provinceId: '1', regionId: '1', municipality: 'X', province: 'X', region: 'X' }];
    MunicipalitiesRepository.data = previous;
    stubProviderFetch({ reject: new Error('Network down') });

    await realtimeDataService.loadMunicipalities();

    expect(MunicipalitiesRepository.data).toBe(previous);
    expect(logger.error).toHaveBeenCalled();
  });

  it('municipalitiesController serves the repository data', async () => {
    stubProviderFetch({ municipalities: municipalitiesResponse() });
    await realtimeDataService.loadMunicipalities();

    const res = createMockRes();
    await municipalitiesController({} as Request, res, next);

    expect(res.send).toHaveBeenCalledWith({ municipalities: MunicipalitiesRepository.data });
  });
});
