import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { municipalitiesController } from '@/controllers/municipalities.controller';
import { logger } from '@/utils/logger';
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import { sendApiError } from '@/utils/error-handler';

const mockLoggerError = vi.mocked(logger.error);
const mockSendApiError = vi.mocked(sendApiError);

// ── Tests ──────────────────────────────────────────────────────────────────

describe('municipalitiesController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_MUNICIPALITIES;
  });

  afterEach(() => {
    // Always reset repository data to a plain writable array after each test
    Object.defineProperty(MunicipalitiesRepository, 'data', {
      value: [],
      writable: true,
      configurable: true,
    });
  });

  describe('DISABLE_MUNICIPALITIES flag', () => {
    it('returns 500 with INTERNAL_ERROR when DISABLE_MUNICIPALITIES is true', async () => {
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => {
          if (process.env.DISABLE_MUNICIPALITIES === 'true') {
            throw { error: { message: 'Municipalities endpoint disabled', code: 'INTERNAL_ERROR' } };
          }
          return [];
        },
        configurable: true,
      });
      process.env.DISABLE_MUNICIPALITIES = 'true';
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });

    it('does not block when DISABLE_MUNICIPALITIES is false', async () => {
      MunicipalitiesRepository.data = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
      ];
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities: expect.arrayContaining([
          expect.objectContaining({ municipality: 'Madrid' }),
        ]),
      });
    });

    it('proceeds normally by default', async () => {
      MunicipalitiesRepository.data = [];
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({ municipalities: [] });
    });
  });

  describe('response format', () => {
    it('returns municipalities wrapped in response object', async () => {
      const municipalities = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '02',
          provinceId: '08',
          regionId: '08',
          municipality: 'Barcelona',
          province: 'Barcelona',
          region: 'Cataluña',
        },
      ];
      MunicipalitiesRepository.data = municipalities;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities,
      });
    });

    it('returns empty municipalities array when no data', async () => {
      MunicipalitiesRepository.data = [];

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({ municipalities: [] });
    });

    it('returns all municipalities from repository', async () => {
      const municipalities = [
        {
          municipalityId: '01',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '08',
          provinceId: '08',
          regionId: '08',
          municipality: 'Barcelona',
          province: 'Barcelona',
          region: 'Cataluña',
        },
        {
          municipalityId: '29',
          provinceId: '29',
          regionId: '29',
          municipality: 'Granada',
          province: 'Granada',
          region: 'Andalucía',
        },
      ];
      MunicipalitiesRepository.data = municipalities;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities,
      });
    });
  });

  describe('error handling', () => {
    it('sends INTERNAL_ERROR (500) for INTERNAL_ERROR errors', async () => {
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => {
          throw { error: { message: 'Internal error', code: 'INTERNAL_ERROR' } };
        },
        configurable: true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles unexpected errors by logging and passing to next', async () => {
      // Simulate an unexpected error by throwing from within the try block.
      // We can do this by making MunicipalitiesRepository.data getter throw.
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => { throw new Error('Unexpected repository error'); },
        configurable: true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in municipalities endpoint',
        { error: 'Unexpected repository error' }
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });

    it('handles non-Error unexpected exceptions (string)', async () => {
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => { throw 'String error'; },
        configurable: true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in municipalities endpoint',
        { error: 'String error' }
      );
      expect(next).toHaveBeenCalled();
    });

    it('handles null unexpected exceptions', async () => {
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => { throw null; },
        configurable: true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles undefined unexpected exceptions', async () => {
      Object.defineProperty(MunicipalitiesRepository, 'data', {
        get: () => { throw undefined; },
        configurable: true,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles municipalityId with various formats', async () => {
      const municipalities = [
        {
          municipalityId: '1',
          provinceId: '01',
          regionId: '01',
          municipality: 'Alovera',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '01001',
          provinceId: '01',
          regionId: '01',
          municipality: 'Madrid',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
      ];
      MunicipalitiesRepository.data = municipalities;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities,
      });
    });

    it('returns data with special characters in municipality names', async () => {
      const municipalities = [
        {
          municipalityId: '02',
          provinceId: '28',
          regionId: '28',
          municipality: 'Alcalá de Henares',
          province: 'Madrid',
          region: 'Comunidad de Madrid',
        },
        {
          municipalityId: '03',
          provinceId: '43',
          regionId: '51',
          municipality: 'Vitoria-Gasteiz',
          province: 'Araba/Álava',
          region: 'País Vasco',
        },
      ];
      MunicipalitiesRepository.data = municipalities;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities,
      });
    });
  });
});
