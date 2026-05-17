import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { Op } from 'sequelize';

// ── Mocks (vi.mock is hoisted — no top-level refs inside factory) ──────────

vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
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

vi.mock('@/utils/case-keys', () => ({
  keysToCamel: vi.fn((obj) => {
    if (Array.isArray(obj)) return obj.map(keysToCamel);
    if (obj && typeof obj === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        out[key.replace(/_([a-z])/g, (_m, p) => p.toUpperCase())] = value;
      }
      return out;
    }
    return obj;
  }),
}));

vi.mock('@/utils/historic-data-limit', () => ({
  getHistoricDataMaxRangeMonths: vi.fn(() => null),
  formatRange: vi.fn((months) => `${months} months`),
}));

vi.mock('@/models/db/HistoricFuelStation', () => {
  const mockAuthenticate = vi.fn(() => Promise.resolve());
  return {
    HistoricFuelStation: {
      sequelize: { authenticate: mockAuthenticate },
      findAll: vi.fn(() => Promise.resolve([])),
    },
  };
});

vi.mock('@/models/db/FuelStations', () => ({
  FuelStationsTable: {
    findOne: vi.fn(() => Promise.resolve(null)),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import * as Sentry from '@sentry/node';
import { historicPricesController } from '../historic-prices.controller';
import { logger } from '@/utils/logger';
import { HistoricFuelStation } from '@/models/db/HistoricFuelStation';
import { FuelStationsTable } from '@/models/db/FuelStations';
import { sendApiError } from '@/utils/error-handler';
import { getHistoricDataMaxRangeMonths, formatRange } from '@/utils/historic-data-limit';
import { GetHistoricPricesQueryParams } from '@/models/in/GetHistoricPricesQueryParams.model';
import { keysToCamel } from '@/utils/case-keys';

const mockSentryCaptureException = vi.mocked(Sentry.captureException);
const mockLoggerError = vi.mocked(logger.error);
const mockFindAll = vi.mocked(HistoricFuelStation.findAll);
const mockFuelStationsFindOne = FuelStationsTable.findOne as ReturnType<typeof vi.fn>;
const mockSendApiError = vi.mocked(sendApiError);
const mockGetHistoricDataMaxRangeMonths = vi.mocked(getHistoricDataMaxRangeMonths);
const mockFormatRange = vi.mocked(formatRange);
const mockAuthenticate = (HistoricFuelStation.sequelize! as any).authenticate as ReturnType<typeof vi.fn>;
const mockSequelize = HistoricFuelStation.sequelize! as any;

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

function createMockRequest(overrides: Record<string, unknown> = {}) {
  return {
    query: {},
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request<{}, {}, {}, GetHistoricPricesQueryParams>;
}

function createMockHistoricRow(dataValues: Record<string, unknown>) {
  return {
    dataValues,
    get: vi.fn(() => dataValues),
    getDataValue: vi.fn((key: string) => dataValues[key]),
  } as unknown as import('sequelize').Model;
}

function createMockFuelStation(dataValues: Record<string, unknown>) {
  return {
    dataValues,
    get: vi.fn(() => dataValues),
    getDataValue: vi.fn((key: string) => dataValues[key]),
  } as unknown as import('sequelize').Model;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('historicPricesController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore sequelize reference — some tests set it to null
    (HistoricFuelStation as any).sequelize = mockSequelize;
    // Restore environment
    process.env = { ...originalEnv };
    delete process.env.DISABLE_SERVICE_STATIONS_HISTORIC;
    delete process.env.HISTORIC_DATA_MAX_RANGE;
    // Reset mocks to default behavior
    mockFindAll.mockResolvedValue([]);
    mockAuthenticate.mockResolvedValue(undefined);
    mockFuelStationsFindOne.mockResolvedValue(null);
    mockGetHistoricDataMaxRangeMonths.mockReturnValue(null);
  });

  afterEach(() => {
    // Ensure sequelize is restored even if a test crashes
    (HistoricFuelStation as any).sequelize = mockSequelize;
  });

  describe('DISABLE_SERVICE_STATIONS_HISTORIC flag', () => {
    it('returns 400 when DISABLE_SERVICE_STATIONS_HISTORIC is true', async () => {
      process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'true';
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it('does not block when DISABLE_SERVICE_STATIONS_HISTORIC is false', async () => {
      process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'false';
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFindAll).toHaveBeenCalled();
    });

    it('proceeds when DISABLE_SERVICE_STATIONS_HISTORIC is not set', async () => {
      delete process.env.DISABLE_SERVICE_STATIONS_HISTORIC;
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFindAll).toHaveBeenCalled();
    });
  });

  describe('database initialization', () => {
    it('returns 500 when HistoricFuelStation.sequelize is not initialized', async () => {
      (HistoricFuelStation as any).sequelize = null;
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });
  });

  describe('startDate validation', () => {
    it('returns 400 when startDate has invalid format (dd/mm/yyyy)', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '01/01/2024', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      // Luxon DateTime.fromSQL does not throw — returns invalid DateTime
      // which makes diff() return NaN, triggering BAD_REQUEST
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('returns 400 when startDate is not a date string', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: 'not-a-date', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 when startDate is empty', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('endDate validation', () => {
    it('returns 400 when endDate has invalid format (dd-mm-yyyy)', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '31-12-2024' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      // Luxon DateTime.fromSQL does not throw — returns invalid DateTime
      // which makes diff() return NaN, triggering BAD_REQUEST
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('returns 400 when endDate is not a date string', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: 'invalid' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('date range validation', () => {
    it('queries with reversed date range when startDate is after endDate', async () => {
      // NOTE: Controller uses isNaN(diff) which only catches invalid dates,
      // not reversed ranges. A negative diff passes validation.
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-12-31', endDate: '2024-01-01' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      // Query proceeds with reversed range — database returns no results
      expect(mockFindAll).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('max range validation', () => {
    it('returns 400 when date range exceeds maximum', async () => {
      mockGetHistoricDataMaxRangeMonths.mockReturnValue(12);
      mockFormatRange.mockReturnValue('1 year');

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2020-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('does not reject when date range is within maximum', async () => {
      mockGetHistoricDataMaxRangeMonths.mockReturnValue(24);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFindAll).toHaveBeenCalled();
    });

    it('does not check range when max range is null (no limit)', async () => {
      mockGetHistoricDataMaxRangeMonths.mockReturnValue(null);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2000-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFindAll).toHaveBeenCalled();
    });
  });

  describe('historic data query', () => {
    it('queries HistoricFuelStation with correct stationId and date range', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            stationId: 'ES0001',
            date: {
              [Op.between]: [expect.any(String), expect.any(String)],
            },
          },
          order: [['date', 'ASC']],
          attributes: { exclude: ['id'] },
        })
      );
    });

    it('handles id as array (takes first element)', async () => {
      const req = createMockRequest({
        query: { id: ['ES0001', 'ES0002'], startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      // Verify findAll was called and used first element of array as stationId
      expect(mockFindAll).toHaveBeenCalled();
      const callArgs = (mockFindAll as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.where.stationId).toBe('ES0001');
    });

    it('returns formatted historic data ordered by date ASC', async () => {
      mockFindAll.mockResolvedValue([
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
          gasoline95E5Price: 1.6,
        }),
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-02-15',
          gasoilAPrice: 1.52,
          gasoline95E5Price: 1.62,
        }),
      ]);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData).toHaveLength(2);
      expect(responseData[0].date).toBe('2024-01-15');
      expect(responseData[1].date).toBe('2024-02-15');
    });

    it('returns empty array when no historic data matches', async () => {
      mockFindAll.mockResolvedValue([]);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('includeCurrentPrices', () => {
    it('does not query FuelStationsTable when includeCurrentPrices is false', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: false },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFuelStationsFindOne).not.toHaveBeenCalled();
    });

    it('does not query FuelStationsTable when includeCurrentPrices is omitted', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFuelStationsFindOne).not.toHaveBeenCalled();
    });

    it('queries FuelStationsTable when includeCurrentPrices is true', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: true },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFuelStationsFindOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { stationId: 'ES0001' },
        })
      );
    });

    it('appends current prices to historic results when includeCurrentPrices is true', async () => {
      mockFindAll.mockResolvedValue([
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
        }),
      ]);
      mockFuelStationsFindOne.mockResolvedValue(
        createMockFuelStation({
          id: 'ES0001',
          stationId: 'ES0001',
          signage: 'Shell',
          gasoilAPrice: 1.55,
        })
      );

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: true },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData).toHaveLength(2);
      expect(responseData[1]).toHaveProperty('stationId', 'ES0001');
    });

    it('handles null current prices gracefully', async () => {
      mockFuelStationsFindOne.mockResolvedValue(null);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: true },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.json).toHaveBeenCalledWith([]);
    });
  });

  describe('response format', () => {
    it('returns array of HistoricPrice objects', async () => {
      mockFindAll.mockResolvedValue([
        createMockHistoricRow({
          stationId: 'ES0001',
          stationSignage: 'Shell',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
          gasoline95E5Price: 1.6,
        }),
      ]);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(Array.isArray(responseData)).toBe(true);
    });

    it('maps snake_case keys to camelCase in response', async () => {
      mockFindAll.mockResolvedValue([
        createMockHistoricRow({
          stationId: 'ES0001',
          station_signage: 'Shell',
          date: '2024-01-15',
          gasoil_a_price: 1.5,
        }),
      ]);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData[0]).toHaveProperty('gasoilAPrice');
    });
  });

  describe('error handling', () => {
    it('sends BAD_REQUEST (400) for invalid date format', async () => {
      // DateTime.fromSQL('invalid') returns invalid DateTime,
      // diff() returns NaN, triggering BAD_REQUEST (not VALIDATION_ERROR)
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: 'invalid', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('sends BAD_REQUEST (400) for bad request errors', async () => {
      process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'true';
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'BAD_REQUEST' }),
        })
      );
    });

    it('sends INTERNAL_ERROR (500) for database not initialized', async () => {
      (HistoricFuelStation as any).sequelize = null;

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('sends NOT_FOUND (404) for NOT_FOUND errors', async () => {
      mockAuthenticate.mockRejectedValue({
        error: { message: 'Resource not found', code: 'NOT_FOUND' },
      });

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('captures unexpected errors with Sentry', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        new Error('Database connection lost')
      );
    });

    it('logs unexpected errors with logger.error', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in historic-prices endpoint',
        { error: 'Database connection lost' }
      );
    });

    it('passes internal server error to next middleware', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Database connection lost'));

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
    });

    it('handles non-Error unexpected exceptions (string)', async () => {
      mockAuthenticate.mockRejectedValue('String error');

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith('String error');
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unexpected error in historic-prices endpoint',
        { error: 'String error' }
      );
    });

    it('handles null unexpected exceptions', async () => {
      mockAuthenticate.mockRejectedValue(null);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it('handles undefined unexpected exceptions', async () => {
      mockAuthenticate.mockRejectedValue(undefined);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it('does not call Sentry for invalid date format (BAD_REQUEST path)', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: 'invalid-date', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('does not call Sentry for BAD_REQUEST', async () => {
      process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'true';
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sends 500 for unknown error codes with ApiError shape', async () => {
      mockAuthenticate.mockRejectedValue({
        error: { message: 'Unknown issue', code: 'UNKNOWN_CODE' },
      });

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('database authentication', () => {
    it('calls sequelize.authenticate before querying data', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(mockFindAll).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles multiple historic results correctly', async () => {
      const historicData = [
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-01-01',
          gasoilAPrice: 1.5,
        }),
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-02-01',
          gasoilAPrice: 1.52,
        }),
        createMockHistoricRow({
          stationId: 'ES0001',
          date: '2024-03-01',
          gasoilAPrice: 1.48,
        }),
      ];
      mockFindAll.mockResolvedValue(historicData);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData).toHaveLength(3);
    });

    it('handles startDate equal to endDate', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-06-15', endDate: '2024-06-15' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockFindAll).toHaveBeenCalled();
    });

    it('handles current prices with id field instead of stationId', async () => {
      mockFindAll.mockResolvedValue([]);
      mockFuelStationsFindOne.mockResolvedValue(
        createMockFuelStation({
          id: 'ES0001',
          signage: 'Repsol',
          gasoilAPrice: 1.55,
        })
      );

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: true },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData).toHaveLength(1);
      expect(responseData[0]).toHaveProperty('stationId');
    });

    it('handles authenticate rejection as unexpected error', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Connection refused'));

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles findAll rejection as unexpected error', async () => {
      mockFindAll.mockRejectedValue(new Error('Query timeout'));

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
});
