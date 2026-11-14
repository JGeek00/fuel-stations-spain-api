import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@tests/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@tests/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { municipalitiesController } from '@/controllers/municipalities.controller';
import { logger } from '@/utils/logger';
import { municipalitiesRepository } from '@/infrastructure/persistence/MunicipalitiesRepository';
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
    // Reset the repository store through its setter (module-level state).
    municipalitiesRepository.data = [];
  });

  describe('DISABLE_MUNICIPALITIES flag', () => {
    // The disabled-endpoint 404/500 behavior moved to the endpoint-disabled
    // middleware (tests/unit/middlewares/endpoint-disabled.middleware.spec.ts);
    // the controller itself never short-circuits on the flag.

    it('does not block when DISABLE_MUNICIPALITIES is false', async () => {
      municipalitiesRepository.data = [
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
      municipalitiesRepository.data = [];
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
      municipalitiesRepository.data = municipalities;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.send).toHaveBeenCalledWith({
        municipalities,
      });
    });

    it('returns empty municipalities array when no data', async () => {
      municipalitiesRepository.data = [];

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
      municipalitiesRepository.data = municipalities;

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
    // The controller reads through listMunicipalitiesUseCase -> repository.list();
    // failures are simulated by making list() throw.
    function makeListThrow(value: unknown) {
      const listSpy = vi.spyOn(municipalitiesRepository, 'list').mockImplementation(() => {
        throw value;
      });
      return listSpy;
    }

    it('sends INTERNAL_ERROR (500) for INTERNAL_ERROR errors', async () => {
      const listSpy = makeListThrow({ error: { message: 'Internal error', code: 'INTERNAL_ERROR' } });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      listSpy.mockRestore();
    });

    it('handles unexpected errors by logging and passing to next', async () => {
      const listSpy = makeListThrow(new Error('Unexpected repository error'));

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
      listSpy.mockRestore();
    });

    it('handles non-Error unexpected exceptions (string)', async () => {
      const listSpy = makeListThrow('String error');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in municipalities endpoint',
        { error: 'String error' }
      );
      expect(next).toHaveBeenCalled();
      listSpy.mockRestore();
    });

    it('handles null unexpected exceptions', async () => {
      const listSpy = makeListThrow(null);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      listSpy.mockRestore();
    });

    it('handles undefined unexpected exceptions', async () => {
      const listSpy = makeListThrow(undefined);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await municipalitiesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      listSpy.mockRestore();
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
      municipalitiesRepository.data = municipalities;

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
      municipalitiesRepository.data = municipalities;

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
