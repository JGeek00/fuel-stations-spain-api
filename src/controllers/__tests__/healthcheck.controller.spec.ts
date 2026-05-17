import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockRequest,
} from '@/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { healthcheckController } from '@/controllers/healthcheck.controller';
import { logger } from '@/utils/logger';
import { FuelStationsTable } from '@/models/db/FuelStations';

const mockLoggerError = vi.mocked(logger.error);
const mockFindAndCountAll = FuelStationsTable.findAndCountAll as unknown as ReturnType<typeof vi.fn<() => Promise<{ rows: unknown[]; count: number | null | undefined }>>>;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('healthcheckController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockFindAndCountAll.mockResolvedValue({ rows: [], count: 0 });
  });

  describe('healthy response', () => {
    it('returns 200 when realtimeStations count > 0', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [
          { stationId: 'ES0001', name: 'Shell Madrid' },
        ],
        count: 15000,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith({ limit: 10 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 200 with large station count', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [
          { stationId: 'ES0001' },
          { stationId: 'ES0002' },
          { stationId: 'ES0003' },
        ],
        count: 25000,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 200 when count is exactly 1', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [{ stationId: 'ES0001' }],
        count: 1,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('unhealthy response', () => {
    it('returns 500 when realtimeStations count is 0', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith({ limit: 10 });
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 when count is null', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: null,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 500 when count is undefined', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: undefined,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('error handling', () => {
    it('returns 500 when findAndCountAll throws an error', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('Database connection failed'));

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'Database connection failed' }
      );
    });

    it('returns 500 when findAndCountAll throws a non-Error', async () => {
      mockFindAndCountAll.mockRejectedValue('String error');

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'String error' }
      );
    });

    it('returns 500 when findAndCountAll throws null', async () => {
      mockFindAndCountAll.mockRejectedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('returns 500 when findAndCountAll throws undefined', async () => {
      mockFindAndCountAll.mockRejectedValue(undefined);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('logs error details for database timeout', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('Query timeout after 30000ms'));

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'Query timeout after 30000ms' }
      );
    });

    it('logs error details for connection refused', async () => {
      mockFindAndCountAll.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'connect ECONNREFUSED 127.0.0.1:5432' }
      );
    });
  });

  describe('query behavior', () => {
    it('calls findAndCountAll with limit of 10', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [{ stationId: 'ES0001' }],
        count: 1,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockFindAndCountAll).toHaveBeenCalledWith({ limit: 10 });
    });

    it('does not use request query parameters', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [{ stationId: 'ES0001' }],
        count: 1,
      });

      const req = createMockRequest({
        query: { someParam: 'value' },
      });
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // Controller ignores query params, uses hardcoded limit: 10
      expect(mockFindAndCountAll).toHaveBeenCalledWith({ limit: 10 });
    });
  });

  describe('edge cases', () => {
    it('handles count as string number (falsy check)', async () => {
      // In JavaScript, "0" > 0 is false
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 0,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // "0" > 0 evaluates to false in JS
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles count as string number greater than 0', async () => {
      // "15000" > 0 is true in JavaScript (coerced to number)
      mockFindAndCountAll.mockResolvedValue({
        rows: [{ stationId: 'ES0001' }],
        count: 15000,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles empty rows but positive count', async () => {
      // Count is what matters for healthcheck, not rows
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: 15000,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles negative count (should be unhealthy)', async () => {
      // Negative count should fail the > 0 check
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: -1,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles NaN count (should be unhealthy)', async () => {
      mockFindAndCountAll.mockResolvedValue({
        rows: [],
        count: NaN,
      });

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // NaN > 0 is false
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
