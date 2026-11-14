import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request } from 'express';
import { and, asc, between, eq } from 'drizzle-orm';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@tests/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest as _createMockRequest,
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
import { historicPricesController } from '@/interfaces/http/controllers/historic-prices.controller';
import { logger } from '@/shared/utils/logger';
import { fuelStationsTable, getMemoryDb, historicFuelStationsTable } from '@/infrastructure/persistence/memory-db';
import { getHistoricDataMaxRangeMonths, formatRange } from '@/shared/utils/historic-data-limit';
import { GetHistoricPricesQueryParams } from '@/interfaces/http/dto/in/GetHistoricPricesQueryParams.model';

// Type-safe request factory for this controller
function createMockRequest(overrides: Record<string, unknown> = {}): Request<{}, {}, {}, GetHistoricPricesQueryParams> {
  return _createMockRequest(overrides) as unknown as Request<{}, {}, {}, GetHistoricPricesQueryParams>;
}

const mockSentryCaptureException = vi.mocked(Sentry.captureException);
const mockLoggerError = vi.mocked(logger.error);
const mockGetMemoryDb = vi.mocked(getMemoryDb);
const mockGetHistoricDataMaxRangeMonths = vi.mocked(getHistoricDataMaxRangeMonths);
const mockFormatRange = vi.mocked(formatRange);

// ── Drizzle query-builder harness ──────────────────────────────────────────
// Emulates the chainable Drizzle builder used by the controller: rows are
// dispatched per table, `{ value: count() }` selects resolve the count, and
// every chained call is recorded for assertions.
interface DbHarness {
  db: () => unknown;
  setRows: (table: unknown, rows: unknown[]) => void;
  state: { error: unknown };
  calls: {
    select: unknown[];
    from: unknown[];
    where: unknown[];
    orderBy: unknown[];
    limit: unknown[];
  };
}

function makeDbHarness(): DbHarness {
  const tables = new Map<unknown, unknown[]>();
  const state = { error: undefined as unknown };
  const calls = {
    select: [] as unknown[],
    from: [] as unknown[],
    where: [] as unknown[],
    orderBy: [] as unknown[],
    limit: [] as unknown[],
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
        offset: vi.fn(() => b),
      };
      b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => {
        const value =
          mode === 'count' ? [{ value: 0 }] : (tables.get(fromTable) ?? []);
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

describe('historicPricesController', () => {
  const originalEnv = { ...process.env };
  let harness: DbHarness;
  const h = historicFuelStationsTable;

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore environment
    process.env = { ...originalEnv };
    delete process.env.HISTORIC_DATA_MAX_RANGE;
    // Reset mocks to default behavior
    harness = makeDbHarness();
    mockGetMemoryDb.mockImplementation(() => harness.db());
    harness.setRows(historicFuelStationsTable, []);
    harness.setRows(fuelStationsTable, []);
    mockGetHistoricDataMaxRangeMonths.mockReturnValue(null);
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
      expect(mockGetMemoryDb).toHaveBeenCalled();
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

      expect(mockGetMemoryDb).toHaveBeenCalled();
    });

    it('does not check range when max range is null (no limit)', async () => {
      mockGetHistoricDataMaxRangeMonths.mockReturnValue(null);

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2000-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockGetMemoryDb).toHaveBeenCalled();
    });
  });

  describe('historic data query', () => {
    it('queries historic prices with correct stationId and date range', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(harness.calls.where[0]).toEqual(
        and(
          eq(h.stationId, 'ES0001'),
          between(h.date, '2024-01-01', '2024-12-31')
        )
      );
      expect(harness.calls.orderBy[0]).toEqual(asc(h.date));
    });

    it('selects explicitly without the id column', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      const projection = harness.calls.select[0] as Record<string, unknown>;
      expect(Object.keys(projection)).not.toContain('id');
    });

    it('handles id as array (takes first element)', async () => {
      const req = createMockRequest({
        query: { id: ['ES0001', 'ES0002'], startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      // Verify the query was built with the first element of the array as stationId
      expect(harness.calls.where[0]).toEqual(
        and(eq(h.stationId, 'ES0001'), between(h.date, '2024-01-01', '2024-12-31'))
      );
    });

    it('returns formatted historic data ordered by date ASC', async () => {
      harness.setRows(historicFuelStationsTable, [
        {
          stationId: 'ES0001',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
          gasoline95E5Price: 1.6,
        },
        {
          stationId: 'ES0001',
          date: '2024-02-15',
          gasoilAPrice: 1.52,
          gasoline95E5Price: 1.62,
        },
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
      harness.setRows(historicFuelStationsTable, []);

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
    it('does not query the fuel stations table when includeCurrentPrices is false', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: false },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(harness.calls.from).not.toContain(fuelStationsTable);
    });

    it('does not query the fuel stations table when includeCurrentPrices is omitted', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(harness.calls.from).not.toContain(fuelStationsTable);
    });

    it('queries the fuel stations table when includeCurrentPrices is true', async () => {
      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2024-01-01', endDate: '2024-12-31', includeCurrentPrices: true },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(harness.calls.from).toContain(fuelStationsTable);
      expect(harness.calls.where[1]).toEqual(eq(fuelStationsTable.stationId, 'ES0001'));
    });

    it('appends current prices to historic results when includeCurrentPrices is true', async () => {
      harness.setRows(historicFuelStationsTable, [
        {
          stationId: 'ES0001',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
        },
      ]);
      harness.setRows(fuelStationsTable, [
        {
          id: 'ES0001',
          stationId: 'ES0001',
          signage: 'Shell',
          gasoilAPrice: 1.55,
        },
      ]);

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
      harness.setRows(fuelStationsTable, []);

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
      harness.setRows(historicFuelStationsTable, [
        {
          stationId: 'ES0001',
          stationSignage: 'Shell',
          date: '2024-01-15',
          gasoilAPrice: 1.5,
          gasoline95E5Price: 1.6,
        },
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
      harness.setRows(historicFuelStationsTable, [
        {
          stationId: 'ES0001',
          station_signage: 'Shell',
          date: '2024-01-15',
          gasoil_a_price: 1.5,
        },
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

    it('does not call Sentry for BAD_REQUEST (max range exceeded)', async () => {
      mockGetHistoricDataMaxRangeMonths.mockReturnValue(12);
      mockFormatRange.mockReturnValue('1 year');

      const req = createMockRequest({
        query: { id: 'ES0001', startDate: '2020-01-01', endDate: '2024-12-31' },
      });
      const res = createMockResponse();
      const next = createMockNext();

      await historicPricesController(req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('edge cases', () => {
    it('handles multiple historic results correctly', async () => {
      harness.setRows(historicFuelStationsTable, [
        {
          stationId: 'ES0001',
          date: '2024-01-01',
          gasoilAPrice: 1.5,
        },
        {
          stationId: 'ES0001',
          date: '2024-02-01',
          gasoilAPrice: 1.52,
        },
        {
          stationId: 'ES0001',
          date: '2024-03-01',
          gasoilAPrice: 1.48,
        },
      ]);

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

      expect(mockGetMemoryDb).toHaveBeenCalled();
    });

    it('handles current prices with id field instead of stationId', async () => {
      harness.setRows(historicFuelStationsTable, []);
      harness.setRows(fuelStationsTable, [
        {
          id: 'ES0001',
          signage: 'Repsol',
          gasoilAPrice: 1.55,
        },
      ]);

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

    it('handles query rejection as unexpected error', async () => {
      harness.state.error = new Error('Query timeout');

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
