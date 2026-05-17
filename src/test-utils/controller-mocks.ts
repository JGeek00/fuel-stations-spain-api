import type { NextFunction, Request, Response } from 'express';
import { Mock } from 'vitest';
import { keysToCamel } from '@/utils/case-keys';

// ─── Shared vi.mock definitions ─────────────────────────────────────────────
// These vi.mock calls are hoisted by Vitest. Import this file FIRST in any
// controller test so that all mocks are registered before the real modules load.

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
  createNotFoundError: vi.fn((message) => ({
    error: { message, code: 'NOT_FOUND' },
  })),
  createInternalServerError: vi.fn((message, error) => ({
    error: {
      message,
      code: 'INTERNAL_ERROR',
      details: error,
    },
  })),
  errorStatus: vi.fn((code) => {
    const map: Record<string, number> = {
      VALIDATION_ERROR: 400,
      NOT_FOUND: 404,
      INTERNAL_ERROR: 500,
      BAD_REQUEST: 400,
    };
    return map[code] ?? 500;
  }),
  sendApiError: vi.fn((res, apiError, statusCode) => {
    res.status(statusCode).json(apiError);
  }),
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
    findOne: vi.fn(() => Promise.resolve(null)),
  },
  FuelStationModel: {},
}));

vi.mock('@/models/db/LastUpdated', () => ({
  LastUpdated: {
    findAll: vi.fn(),
  },
  LastUpdatedModel: {},
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

vi.mock('@/repository/Municipalities.repository', () => {
  const repo = {
    data: [],
  };
  Object.defineProperty(repo, 'data', {
    value: [],
    writable: true,
    configurable: true,
  });
  return {
    default: repo,
  };
});

// ─── Shared helper factories ────────────────────────────────────────────────

/**
 * Creates a mock Express Response with chained `.status().json()` spies.
 */
export function createMockResponse(): Response {
  const statusSpy = vi.fn().mockReturnThis();
  const jsonSpy = vi.fn().mockReturnThis();
  return {
    status: statusSpy,
    json: jsonSpy,
    send: vi.fn(),
  } as unknown as Response;
}

/**
 * Creates a mock Express next middleware function.
 */
export function createMockNext(): NextFunction & Mock {
  return vi.fn(() => {}) as NextFunction & Mock;
}

/**
 * Creates a mock Express Request with optional overrides.
 * @param overrides - Properties to merge into the default mock request.
 */
export function createMockRequest(overrides: Record<string, unknown> = {}): Request {
  return {
    query: {},
    body: {},
    params: {},
    ...overrides,
  } as unknown as Request;
}

/**
 * Creates a mock Sequelize Model instance with the given dataValues.
 */
export function createMockRow(dataValues: Record<string, unknown>) {
  return {
    dataValues,
    get: vi.fn(() => dataValues),
    getDataValue: vi.fn((key: string) => dataValues[key]),
  } as unknown as import('sequelize').Model;
}

/**
 * Creates a mock LastUpdated Sequelize row.
 */
export function createMockLastUpdated(lastUpdated: Date) {
  return {
    dataValues: { lastUpdated },
    getDataValue: vi.fn(() => lastUpdated),
  } as unknown as import('sequelize').Model;
}
