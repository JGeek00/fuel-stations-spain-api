import { describe, it, expect, vi, beforeEach } from 'vitest';
import { and, between, eq, inArray } from 'drizzle-orm';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@tests/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@tests/test-utils/controller-mocks';

vi.mock('@/infrastructure/persistence/memory-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/persistence/memory-db')>();
  return {
    ...actual,
    getMemoryDb: vi.fn(),
  };
});

// ── Imports (after mocks) ──────────────────────────────────────────────────

import * as Sentry from '@sentry/node';
import { validationResult } from 'express-validator';
import { serviceStationsController } from '@/interfaces/http/controllers/service-stations.controller';
import { logger } from '@/shared/utils/logger';
import { calculateBoundingBox } from '@/shared/utils/calculate-distance';
import { fuelStationsTable, getMemoryDb, lastUpdatedTable } from '@/infrastructure/persistence/memory-db';
import { sendApiError } from '@/shared/errors/error-handler';

const mockSentryCaptureException = vi.mocked(Sentry.captureException);
const mockLoggerError = vi.mocked(logger.error);
const mockCalculateBoundingBox = vi.mocked(calculateBoundingBox);
const mockGetMemoryDb = vi.mocked(getMemoryDb);
const mockValidationResult = vi.mocked(validationResult);

// ── Drizzle query-builder harness ──────────────────────────────────────────
// Emulates the chainable Drizzle builder: `select(...)` decides between a row
// select and a `{ value: count() }` select, `from(table)` picks which mocked
// row set resolves, and every chained call is recorded for assertions.
interface DbHarness {
  db: () => unknown;
  setRows: (table: unknown, rows: unknown[]) => void;
  state: { count: number; error: unknown };
  calls: {
    select: unknown[];
    from: unknown[];
    where: unknown[];
    orderBy: unknown[];
    limit: unknown[];
    offset: unknown[];
  };
}

function makeDbHarness(): DbHarness {
  const tables = new Map<unknown, unknown[]>();
  const state = { count: 0, error: undefined as unknown };
  const calls = {
    select: [] as unknown[],
    from: [] as unknown[],
    where: [] as unknown[],
    orderBy: [] as unknown[],
    limit: [] as unknown[],
    offset: [] as unknown[],
  };

  const db = () => {
    const makeBuilder = (mode: 'rows' | 'count', projection: unknown) => {
      calls.select.push(projection);
      let fromTable: unknown;
      const b: Record<string, any> = {
        from: vi.fn((t: unknown) => {
          calls.from.push(t);
          fromTable = t;
          return b;
        }),
        where: vi.fn((c: unknown) => {
          calls.where.push(c);
          return b;
        }),
        orderBy: vi.fn((...o: unknown[]) => {
          calls.orderBy.push(...o);
          return b;
        }),
        limit: vi.fn((n: unknown) => {
          calls.limit.push(n);
          return b;
        }),
        offset: vi.fn((n: unknown) => {
          calls.offset.push(n);
          return b;
        }),
      };
      b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        const value =
          mode === 'count' ? [{ value: state.count }] : (tables.get(fromTable) ?? []);
        const pending = state.error !== undefined ? Promise.reject(state.error) : Promise.resolve(value);
        return pending.then(onFulfilled, onRejected);
      };
      return b;
    };
    return {
      select: vi.fn((projection?: Record<string, unknown>) =>
        makeBuilder(projection && 'value' in projection ? 'count' : 'rows', projection)
      ),
    };
  };

  return {
    db,
    setRows: (table: unknown, rows: unknown[]) => {
      tables.set(table, rows);
    },
    state,
    calls,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('serviceStationsController', () => {
  const originalEnv = { ...process.env };
  let harness: DbHarness;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    harness = makeDbHarness();
    mockGetMemoryDb.mockImplementation(() => harness.db());
    harness.setRows(fuelStationsTable, []);
    harness.setRows(lastUpdatedTable, [{ lastUpdated: new Date('2024-01-01') }]);
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

      expect(mockGetMemoryDb).toHaveBeenCalled();
    });

    it('does not error when only coordinates are provided', async () => {
      const req = createMockRequest({
        query: { coordinates: '40.4,-3.7' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockGetMemoryDb).toHaveBeenCalled();
    });
  });

  describe('pagination logic', () => {
    it('applies default limit and offset when no filters', async () => {
      const req = createMockRequest({ query: {} });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit[0]).toBe(30);
      expect(harness.calls.offset[0]).toBe(0);
    });

    it('uses custom limit and offset when provided', async () => {
      const req = createMockRequest({ query: { limit: 50, offset: 10 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit[0]).toBe(50);
      expect(harness.calls.offset[0]).toBe(10);
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

      expect(harness.calls.limit[0]).toBe(210);
      expect(harness.calls.offset[0]).toBe(10);
    });

    it('does not apply pagination when id filter is present', async () => {
      const req = createMockRequest({ query: { id: 'ES0001' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit).toEqual([]);
      expect(harness.calls.offset).toEqual([]);
    });

    it('does not apply pagination when coordinates filter is present', async () => {
      const req = createMockRequest({ query: { coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit).toEqual([]);
      expect(harness.calls.offset).toEqual([]);
    });

    it('does not apply pagination when municipalityId filter is present', async () => {
      const req = createMockRequest({ query: { municipalityId: 28079 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit).toEqual([]);
      expect(harness.calls.offset).toEqual([]);
    });

    it('does not apply pagination when distance filter is present with coordinates', async () => {
      const req = createMockRequest({ query: { distance: 20, coordinates: '40.4,-3.7' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.limit).toEqual([]);
      expect(harness.calls.offset).toEqual([]);
    });

    it('falls back to default limit when limit=0 (falsy)', async () => {
      const req = createMockRequest({ query: { limit: 0, offset: 0 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // limit=0 is falsy (req.query.limit ? req.query.limit : default)
      // → falls back to config.defaults.query.limit (30)
      expect(harness.calls.limit[0]).toBe(30);
      expect(harness.calls.offset[0]).toBe(0);
    });
  });

  describe('municipalityId filter', () => {
    it('filters by municipalityId', async () => {
      const req = createMockRequest({ query: { municipalityId: 28079 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(eq(fuelStationsTable.municipalityId, 28079));
    });

    it('uses empty where clause when municipalityId is falsy', async () => {
      const req = createMockRequest({ query: { municipalityId: 0 } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // municipalityId: 0 is falsy, so no where condition is built
      // Pagination applies since no filters
      expect(harness.calls.where[0]).toBeUndefined();
      expect(harness.calls.limit[0]).toBe(30);
      expect(harness.calls.offset[0]).toBe(0);
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
      expect(harness.calls.where[0]).toEqual(
        and(
          between(fuelStationsTable.latitude, 40.3, 40.5),
          between(fuelStationsTable.longitude, -3.8, -3.6)
        )
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

      expect(harness.calls.where[0]).toEqual(inArray(fuelStationsTable.stationId, ['ES0001']));
    });

    it('filters by array of ids', async () => {
      const req = createMockRequest({ query: { id: ['ES0001', 'ES0002', 'ES0003'] } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(
        inArray(fuelStationsTable.stationId, ['ES0001', 'ES0002', 'ES0003'])
      );
    });

    it('wraps single id in array for inArray', async () => {
      const req = createMockRequest({ query: { id: 'ES0001' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(inArray(fuelStationsTable.stationId, ['ES0001']));
    });

    it('filters by array with a single id', async () => {
      const req = createMockRequest({ query: { id: ['ES0001'] } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(inArray(fuelStationsTable.stationId, ['ES0001']));
    });
  });

  describe('response format', () => {
    it('returns lastUpdated, count, and results', async () => {
      const lastUpdatedDate = new Date('2024-06-15T10:30:00Z');
      harness.setRows(lastUpdatedTable, [{ lastUpdated: lastUpdatedDate }]);
      harness.setRows(fuelStationsTable, [
        {
          stationId: 'ES0001',
          name: 'Shell Madrid',
          latitude: 40.4168,
          longitude: -3.7038,
        },
      ]);
      harness.state.count = 1;

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
      harness.setRows(fuelStationsTable, [
        { stationId: 'ES0001', name: 'Shell' },
        { stationId: 'ES0002', name: 'Repsol' },
      ]);
      harness.state.count = 2;

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
      harness.setRows(fuelStationsTable, []);
      harness.state.count = 0;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      const responseData = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(responseData.count).toBe(0);
      expect(responseData.results).toEqual([]);
    });

    it('preserves other fields in mapped results', async () => {
      harness.setRows(fuelStationsTable, [
        {
          stationId: 'ES0001',
          name: 'Shell',
          latitude: 40.4168,
          longitude: -3.7038,
          province: 'Madrid',
        },
      ]);
      harness.state.count = 1;

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
      harness.setRows(lastUpdatedTable, [{ lastUpdated: lastUpdatedDate }]);

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
      harness.state.error = { error: { message: 'Station not found', code: 'NOT_FOUND' } };

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('captures unexpected errors with Sentry', async () => {
      harness.state.error = new Error('Database connection lost');

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith(
        new Error('Database connection lost')
      );
    });

    it('logs unexpected errors with logger.error', async () => {
      harness.state.error = new Error('Database connection lost');

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
      harness.state.error = new Error('Database connection lost');

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
      harness.state.error = 'String error';

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
      harness.state.error = null;

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalled();
    });

    it('handles undefined unexpected exceptions', async () => {
      // undefined leaves the reject branch disabled; force a rejection by
      // removing the rows so the query fails in a different way is not
      // possible here — reproduce the original case with a rejected promise
      // by making the harness error an Error with undefined-like behavior.
      harness.state.error = undefined;
      mockGetMemoryDb.mockImplementation(() => {
        throw undefined;
      });

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).toHaveBeenCalledWith(undefined);
    });

    it('does not call Sentry for VALIDATION_ERROR', async () => {
      harness.state.error = {
        error: { message: 'Validation failed', code: 'VALIDATION_ERROR', details: [] },
      };

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('does not call Sentry for BAD_REQUEST', async () => {
      harness.state.error = { error: { message: 'Bad request', code: 'BAD_REQUEST' } };

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('sends 500 for unknown error codes with ApiError shape', async () => {
      harness.state.error = { error: { message: 'Unknown issue', code: 'UNKNOWN_CODE' } };

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

      expect(harness.calls.where[0]).toEqual(inArray(fuelStationsTable.stationId, ['ES0001']));
    });

    it('coordinates filter overrides municipalityId', async () => {
      const req = createMockRequest({
        query: { municipalityId: 28079, coordinates: '40.4,-3.7' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(
        and(
          between(fuelStationsTable.latitude, expect.any(Number), expect.any(Number)),
          between(fuelStationsTable.longitude, expect.any(Number), expect.any(Number))
        )
      );
    });

    it('id filter overrides coordinates filter', async () => {
      const req = createMockRequest({
        query: { coordinates: '40.4,-3.7', id: 'ES0001' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      expect(harness.calls.where[0]).toEqual(inArray(fuelStationsTable.stationId, ['ES0001']));
    });
  });

  describe('edge cases', () => {
    it('throws when lastUpdated array is empty', async () => {
      harness.setRows(lastUpdatedTable, []);

      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // lastUpdated[0] is undefined => reading lastUpdated throws => caught
      expect(mockSentryCaptureException).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('handles municipalityId as string', async () => {
      const req = createMockRequest({ query: { municipalityId: '28079' } });
      const res = createMockResponse();
      const next = createMockNext();

      await serviceStationsController(req, res, next);

      // The controller passes the raw query-param string through to eq()
      expect(harness.calls.where[0]).toEqual(
        eq(fuelStationsTable.municipalityId, '28079' as unknown as number)
      );
    });

    it('handles multiple results correctly', async () => {
      harness.setRows(fuelStationsTable, [
        { stationId: 'ES0001', name: 'Shell', latitude: 40.4, longitude: -3.7 },
        { stationId: 'ES0002', name: 'Repsol', latitude: 41.3, longitude: 2.1 },
        { stationId: 'ES0003', name: 'BP', latitude: 39.5, longitude: -0.4 },
      ]);
      harness.state.count = 3;

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
