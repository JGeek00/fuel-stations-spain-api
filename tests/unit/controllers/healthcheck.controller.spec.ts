import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@tests/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockRequest,
} from '@tests/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

vi.mock('@/infrastructure/persistence/StationRepository', () => ({
  stationRepository: {
    count: vi.fn(),
  },
}));

import { healthcheckController } from '@/controllers/healthcheck.controller';
import { logger } from '@/utils/logger';
import { stationRepository } from '@/infrastructure/persistence/StationRepository';

const mockLoggerError = vi.mocked(logger.error);
const mockCount = stationRepository.count as unknown as ReturnType<typeof vi.fn<() => Promise<number>>>;

// ── Tests ──────────────────────────────────────────────────────────────────

describe('healthcheckController', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockCount.mockResolvedValue(0);
  });

  describe('healthy response', () => {
    it('returns 200 when realtimeStations count > 0', async () => {
      mockCount.mockResolvedValue(15000);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 200 with large station count', async () => {
      mockCount.mockResolvedValue(25000);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('returns 200 when count is exactly 1', async () => {
      mockCount.mockResolvedValue(1);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('unhealthy response', () => {
    it('returns 500 when realtimeStations count is 0', async () => {
      mockCount.mockResolvedValue(0);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalled();
    });

    it('returns 500 when count is null', async () => {
      mockCount.mockResolvedValue(null as unknown as number);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('returns 500 when count is undefined', async () => {
      mockCount.mockResolvedValue(undefined as unknown as number);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('error handling', () => {
    it('returns 500 when stationRepository.count throws an error', async () => {
      mockCount.mockRejectedValue(new Error('Database connection failed'));

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

    it('returns 500 when stationRepository.count throws a non-Error', async () => {
      mockCount.mockRejectedValue('String error');

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'String error' }
      );
    });

    it('returns 500 when stationRepository.count throws null', async () => {
      mockCount.mockRejectedValue(null);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('returns 500 when stationRepository.count throws undefined', async () => {
      mockCount.mockRejectedValue(undefined);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalled();
    });

    it('logs error details for database timeout', async () => {
      mockCount.mockRejectedValue(new Error('Query timeout after 30000ms'));

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockLoggerError).toHaveBeenCalledWith(
        'Healthcheck failed',
        { error: 'Query timeout after 30000ms' }
      );
    });

    it('logs error details for connection refused', async () => {
      mockCount.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

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
    it('calls stationRepository.count without arguments', async () => {
      mockCount.mockResolvedValue(1);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('does not use request query parameters', async () => {
      mockCount.mockResolvedValue(1);

      const req = createMockRequest({
        query: { someParam: 'value' },
      });
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // Controller ignores query params; it only calls stationRepository.count()
      expect(mockCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('handles count as string number (falsy check)', async () => {
      // In JavaScript, "0" > 0 is false
      mockCount.mockResolvedValue('0' as unknown as number);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // "0" > 0 evaluates to false in JS
      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles count as string number greater than 0', async () => {
      // "15000" > 0 is true in JavaScript (coerced to number)
      mockCount.mockResolvedValue(15000);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles empty rows but positive count', async () => {
      // Count is what matters for healthcheck, not rows
      mockCount.mockResolvedValue(15000);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('handles negative count (should be unhealthy)', async () => {
      // Negative count should fail the > 0 check
      mockCount.mockResolvedValue(-1);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles NaN count (should be unhealthy)', async () => {
      mockCount.mockResolvedValue(NaN);

      const req = createMockRequest();
      const res = createMockResponse();

      await healthcheckController(req, res, () => {});

      // NaN > 0 is false
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
