import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';

// ── Mocks (vi.mock is hoisted — no top-level refs inside factory) ──────────

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));

vi.mock('express-validator', () => ({
  validationResult: vi.fn(() => ({
    isEmpty: vi.fn(() => true),
    array: vi.fn(() => []),
  })),
}));

vi.mock('@/utils/calculate-distance', () => ({
  calculateBoundingBox: vi.fn(
    (lat: number, lon: number, radius: number) => ({
      minLat: lat - radius / 111.32,
      maxLat: lat + radius / 111.32,
      minLon: lon - radius / 111.32,
      maxLon: lon + radius / 111.32,
    }),
  ),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/utils/error-handler', () => ({
  createValidationError: vi.fn((message, details) => ({
    error: { message, code: 'VALIDATION_ERROR', details },
  })),
  createBadRequestError: vi.fn((message) => ({
    error: { message, code: 'BAD_REQUEST' },
  })),
  createInternalServerError: vi.fn((message, error) => ({
    error: { message, code: 'INTERNAL_ERROR', details: error },
  })),
  sendApiError: vi.fn((res, apiError, statusCode) => {
    res.status(statusCode).json(apiError);
  }),
  errorStatus: vi.fn(),
}));

vi.mock('@/config/config.json', () => ({
  default: {
    defaults: {
      query: {
        limit: 30,
        offset: 0,
        distance: 30,
      },
    },
    maximums: {
      query: {
        amount: 200,
        distance: 50,
      },
    },
    minimums: {
      query: {
        distance: 10,
      },
    },
  },
}));

vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findAndCountAll: vi.fn(),
  },
  FuelStationModel: {},
}));

vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: {
    findAll: vi.fn(),
  },
  LastUpdatedModel: {},
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import * as Sentry from '@sentry/node';
import { validationResult } from 'express-validator';
import { serviceStationsController } from '@/controllers/service-stations.controller';
import { logger } from '@/utils/logger';
import { calculateBoundingBox } from '@/utils/calculate-distance';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { LastUpdated } from '@/models/db/LastUpdated';
import { sendApiError } from '@/utils/error-handler';

const mockSentryCaptureException = vi.mocked(Sentry.captureException);
const mockLoggerError = vi.mocked(logger.error);
const mockCalculateBoundingBox = vi.mocked(calculateBoundingBox);
const mockFindAndCountAll = FuelStationsTable.findAndCountAll as unknown as ReturnType<typeof vi.fn<() => Promise<{ rows: unknown[]; count: number }>>>;
const mockLastUpdatedFindAll = vi.mocked(LastUpdated.findAll);
const mockValidationResult = vi.mocked(validationResult);
const mockSendApiError = vi.mocked(sendApiError);

// ── Helpers ────────────────────────────────────────────────────────────────

function createMockResponse() {
  const statusSpy = vi.fn().mockReturnThis();
  const jsonSpy = vi.fn().mockReturnThis();
  return {
    status: statusSpy,
    json: jsonSpy,
    send: vi.fn(),
  } as unknown as Response;
}

function createMockNext() {
  return vi.fn();
}

function createMockRequest(overrides: Record<string, unknown> = {}): Request {
  return {
    query: {},
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRow(dataValues: Record<string, unknown>) {
  return {
    dataValues,
    getDataValue: vi.fn((key: string) => dataValues[key]),
  } as unknown as import('sequelize').Model;
}

function createMockLastUpdated(lastUpdated: Date) {
  return {
    dataValues: { lastUpdated },
    getDataValue: vi.fn(() => lastUpdated),
  } as unknown as import('sequelize').Model;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('serviceStationsController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_SERVICE_STATIONS;
    mockFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });
    mockLastUpdatedFindAll.mockResolvedValue([createMockLastUpdated(new Date('2024-01-01'))]);
    mockCalculateBoundingBox.mockReturnValue({
      minLat: 40.3,
      maxLat: 40.5,
      minLon: -3.8,
      maxLon: -3.6,
    });
    // Default: validation passes
    mockValidationResult.mockReturnValue({
      isEmpty: vi.fn(() => true),
      array: vi.fn(() => []),
    } as any);
  });

  describe('DISABLE_SERVICE_STATIONS flag', () => {
    it('returns 400 when DISABLE_SERVICE_STATIONS is true', async () => {
      process.env.DISABLE_SERVICE_STATIONS = 'true';
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('does not block when DISABLE_SERVICE_STATIONS is false', async () => {
      process.env.DISABLE_SERVICE_STATIONS = 'false';
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalled();
    });

    it('proceeds when DISABLE_SERVICE_STATIONS is not set', async () => {
      delete process.env.DISABLE_SERVICE_STATIONS;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalled();
    });
  });

  describe('validation errors from express-validator', () => {
    it('returns 400 when validationResult has errors', async () => {
      mockValidationResult.mockReturnValue({
        isEmpty: vi.fn(() => false),
        array: vi.fn(() => [{ msg: 'Invalid field', path: 'limit' }]),
      } as any);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
    });
  });

  describe('distance without coordinates validation', () => {
    it('returns 400 when distance is provided without coordinates', async () => {
      const req = createMockRequest({
        query: { distance: 20 },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        })
      );
    });

    it('does not error when distance and coordinates are both provided', async () => {
      const req = createMockRequest({
        query: { distance: 20, coordinates: '40.4,-3.7' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalled();
    });

    it('does not error when only coordinates are provided', async () => {
      const req = createMockRequest({
        query: { coordinates: '40.4,-3.7' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalled();
    });
  });

  describe('pagination logic', () => {
    it('applies default limit and offset when no filters', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 30,
          offset: 0,
        })
      );
    });

    it('uses custom limit and offset when provided', async () => {
      const req = createMockRequest({ query: { limit: 50, offset: 10 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 50,
          offset: 10,
        })
      );
    });

    it('returns 400 when offset >= limit', async () => {
      const req = createMockRequest({ query: { limit: 10, offset: 20 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('clamps limit to offset + max amount', async () => {
      // limit=500, offset=10, max amount=200 => limit becomes 10 + 200 = 210
      const req = createMockRequest({ query: { limit: 500, offset: 10 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 210,
          offset: 10,
        })
      );
    });

    it('does not apply pagination when id filter is present', async () => {
      const req = createMockRequest({ query: { id: 'ES0001' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: undefined,
          offset: undefined,
        })
      );
    });

    it('does not apply pagination when coordinates filter is present', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: undefined,
          offset: undefined,
        })
      );
    });

    it('does not apply pagination when municipalityId filter is present', async () => {
      const req = createMockRequest({ query: { municipalityId: 28079 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: undefined,
          offset: undefined,
        })
      );
    });

    it('does not apply pagination when distance filter is present with coordinates', async () => {
      const req = createMockRequest({ query: { distance: 20, coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: undefined,
          offset: undefined,
        })
      );
    });

    it('falls back to default limit when limit=0 (falsy)', async () => {
      const req = createMockRequest({ query: { limit: 0, offset: 0 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // limit=0 is falsy (req.query.limit ? req.query.limit : default)
      // → falls back to config.defaults.query.limit (30)
      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 30,
          offset: 0,
        })
      );
    });
  });

  describe('municipalityId filter', () => {
    it('filters by municipalityId', async () => {
      const req = createMockRequest({ query: { municipalityId: 28079 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { municipalityId: 28079 },
        })
      );
    });

    it('uses empty where clause when municipalityId is falsy', async () => {
      const req = createMockRequest({ query: { municipalityId: 0 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // municipalityId: 0 is falsy, so the where clause stays {}
      // Pagination applies since no filters
      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 30,
          offset: 0,
        })
      );
    });
  });

  describe('coordinates filter', () => {
    it('builds bounding box where clause from coordinates', async () => {
      mockCalculateBoundingBox.mockReturnValue({
        minLat: 40.3,
        maxLat: 40.5,
        minLon: -3.8,
        maxLon: -3.6,
      });

      const req = createMockRequest({ query: { coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 30);
      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            latitude: { [Op.between]: [40.3, 40.5] },
            longitude: { [Op.between]: [-3.8, -3.6] },
          },
        })
      );
    });

    it('uses custom distance when provided', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7', distance: 15 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 15);
    });

    it('clamps distance to maximum (50)', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7', distance: 100 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 50);
    });

    it('clamps distance to minimum (10)', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7', distance: 5 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 10);
    });

    it('uses default distance (30) when coordinates provided without distance', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(40.4, -3.7, 30);
    });

    it('handles negative coordinates', async () => {
      const req = createMockRequest({ query: { coordinates: '-33.4,-70.6' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(-33.4, -70.6, 30);
    });

    it('handles coordinates at origin (0,0)', async () => {
      const req = createMockRequest({ query: { coordinates: '0,0' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(0, 0, 30);
    });

    it('handles coordinates at edge values', async () => {
      const req = createMockRequest({ query: { coordinates: '90,180' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockCalculateBoundingBox).toHaveBeenCalledWith(90, 180, 30);
    });
  });

  describe('id filter', () => {
    it('filters by single id', async () => {
      const req = createMockRequest({ query: { id: 'ES0001' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: { [Op.in]: ['ES0001'] } },
        })
      );
    });

    it('filters by array of ids', async () => {
      const req = createMockRequest({ query: { id: ['ES0001', 'ES0002', 'ES0003'] } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: { [Op.in]: ['ES0001', 'ES0002', 'ES0003'] } },
        })
      );
    });

    it('wraps single id in array for Op.in', async () => {
      const req = createMockRequest({ query: { id: 'ES0001' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const callArgs = (mockFindAndCountAll.mock.calls as unknown as Array<[any]>)[0][0];
      expect(Array.isArray(callArgs.where.stationId[Op.in])).toBe(true);
    });

    it('filters by array with a single id', async () => {
      const req = createMockRequest({ query: { id: ['ES0001'] } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: { [Op.in]: ['ES0001'] } },
        })
      );
    });
  });

  describe('response format', () => {
    it('returns lastUpdated, count, and results', async () => {
      const lastUpdatedDate = new Date('2024-06-15T10:30:00Z');
      mockLastUpdatedFindAll.mockResolvedValue([createMockLastUpdated(lastUpdatedDate)]);
      mockFindAndCountAll.mockResolvedValue({
        rows: [
          createMockRow({
            stationId: 'ES0001',
            name: 'Shell Madrid',
            latitude: 40.4168,
            longitude: -3.7038,
          }),
        ],
        count: 1,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          lastUpdated: lastUpdatedDate,
          count: 1,
        })
      );
    });

    it('maps stationId to id in results', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [
          createMockRow({
            stationId: 'ES0001',
            name: 'Shell',
          }),
          createMockRow({
            stationId: 'ES0002',
            name: 'Repsol',
          }),
        ],
        count: 2,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.results).toHaveLength(2);
      expect(responseData.results[0].id).toBe('ES0001');
      expect(responseData.results[0].stationId).toBeUndefined();
      expect(responseData.results[1].id).toBe('ES0002');
      expect(responseData.results[1].stationId).toBeUndefined();
    });

    it('returns empty results when no stations match', async () => {
      mockFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.count).toBe(0);
      expect(responseData.results).toEqual([]);
    });

    it('preserves other dataValues in mapped results', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [
          createMockRow({
            stationId: 'ES0001',
            name: 'Shell',
            latitude: 40.4168,
            longitude: -3.7038,
            province: 'Madrid',
          }),
        ],
        count: 1,
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const result = responseData.results[0];
      expect(result.id).toBe('ES0001');
      expect(result.name).toBe('Shell');
      expect(result.latitude).toBe(40.4168);
      expect(result.longitude).toBe(-3.7038);
      expect(result.province).toBe('Madrid');
    });

    it('includes lastUpdated in response', async () => {
      const lastUpdatedDate = new Date('2025-03-01T12:00:00Z');
      mockLastUpdatedFindAll.mockResolvedValue([createMockLastUpdated(lastUpdatedDate)]);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.lastUpdated).toBe(lastUpdatedDate);
    });
  });

  describe('error handling', () => {
    it('sends BAD_REQUEST (400) for offset >= limit', async () => {
      const req = createMockRequest({ query: { limit: 10, offset: 20 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sends NOT_FOUND (404) for NOT_FOUND errors', async () => {
      mockFindAndCountAll.mockRejectedValue({
        error: { message: 'Station not found', code: 'NOT_FOUND' },
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('captures unexpected errors with Sentry', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        new Error('Database connection lost')
      );
    });

    it('logs unexpected errors with logger.error', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in service-stations endpoint',
        { error: 'Database connection lost' }
      );
    });

    it('passes internal server error to next middleware', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });

    it('handles non-Error unexpected exceptions (string)', async () => {
      mockFindAndCountAll.mockRejectedValue('String error');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith('String error');
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in service-stations endpoint',
        { error: 'String error' }
      );
    });

    it('handles null unexpected exceptions', async () => {
      mockFindAndCountAll.mockRejectedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it('handles undefined unexpected exceptions', async () => {
      mockFindAndCountAll.mockRejectedValue(undefined);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it('does not call Sentry for VALIDATION_ERROR', async () => {
      mockFindAndCountAll.mockRejectedValue({
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: [] },
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('does not call Sentry for BAD_REQUEST', async () => {
      mockFindAndCountAll.mockRejectedValue({
        error: { message: 'Bad request', code: 'BAD_REQUEST' },
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sends 500 for unknown error codes with ApiError shape', async () => {
      mockFindAndCountAll.mockRejectedValue({
        error: { message: 'Unknown issue', code: 'UNKNOWN_CODE' },
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('where clause override behavior', () => {
    it('id filter overrides municipalityId', async () => {
      const req = createMockRequest({
        query: { municipalityId: 28079, id: 'ES0001' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: { [Op.in]: ['ES0001'] } },
        })
      );
    });

    it('coordinates filter overrides municipalityId', async () => {
      const req = createMockRequest({
        query: { municipalityId: 28079, coordinates: '40.4,-3.7' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            latitude: expect.any(Object),
            longitude: expect.any(Object),
          }),
        })
      );
    });

    it('id filter overrides coordinates filter', async () => {
      const req = createMockRequest({
        query: { coordinates: '40.4,-3.7', id: 'ES0001' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: { [Op.in]: ['ES0001'] } },
        })
      );
    });
  });

  describe('edge cases', () => {
    it('throws when lastUpdated array is empty', async () => {
      mockLastUpdatedFindAll.mockResolvedValue([]);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // lastUpdated[0] is undefined => getDataValue throws => caught
      expect(mockSentryCaptureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles municipalityId as string', async () => {
      const req = createMockRequest({ query: { municipalityId: '28079' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockFindAndCountAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { municipalityId: '28079' },
        })
      );
    });

    it('handles multiple results correctly', async () => {
      const stations = [
        createMockRow({ stationId: 'ES0001', name: 'Shell', latitude: 40.4, longitude: -3.7 }),
        createMockRow({ stationId: 'ES0002', name: 'Repsol', latitude: 41.3, longitude: 2.1 }),
        createMockRow({ stationId: 'ES0003', name: 'BP', latitude: 39.5, longitude: -0.4 }),
      ];
      mockFindAndCountAll.mockResolvedValue({ rows: stations, count: 3 });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.count).toBe(3);
      expect(responseData.results).toHaveLength(3);
      expect(responseData.results[0].id).toBe('ES0001');
      expect(responseData.results[1].id).toBe('ES0002');
      expect(responseData.results[2].id).toBe('ES0003');
    });
  });
});
