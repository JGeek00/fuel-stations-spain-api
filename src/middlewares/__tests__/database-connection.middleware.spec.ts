import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { databaseConnectionMiddleware } from '@/middlewares/database-connection.middleware';
import { HistoricFuelStation } from '@/models/db/HistoricFuelStation';

const mockAuthenticate = (HistoricFuelStation.sequelize! as any).authenticate as ReturnType<typeof vi.fn>;
const mockSequelize = HistoricFuelStation.sequelize! as any;

describe('databaseConnectionMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore sequelize reference
    (HistoricFuelStation as any).sequelize = mockSequelize;
    mockAuthenticate.mockResolvedValue(undefined);
  });

  afterEach(() => {
    // Ensure sequelize is restored even if a test crashes
    (HistoricFuelStation as any).sequelize = mockSequelize;
  });

  describe('sequelize not initialized', () => {
    it('returns 500 when HistoricFuelStation.sequelize is null', async () => {
      (HistoricFuelStation as any).sequelize = null;
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
      expect(mockAuthenticate).not.toHaveBeenCalled();
    });

    it('returns 500 when HistoricFuelStation.sequelize is undefined', async () => {
      (HistoricFuelStation as any).sequelize = undefined;
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('successful authentication', () => {
    it('calls next() when sequelize.authenticate resolves', async () => {
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('authentication failure', () => {
    it('passes error to next() when sequelize.authenticate rejects', async () => {
      mockAuthenticate.mockRejectedValue(new Error('Connection refused'));
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(mockAuthenticate).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error('Connection refused'));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('passes non-Error rejection to next()', async () => {
      mockAuthenticate.mockRejectedValue('String error');
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith('String error');
    });

    it('passes null rejection to next()', async () => {
      mockAuthenticate.mockRejectedValue(null);
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(null);
    });

    it('passes undefined rejection to next()', async () => {
      mockAuthenticate.mockRejectedValue(undefined);
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(undefined);
    });
  });

  describe('factory behavior', () => {
    it('returns a function when called', () => {
      const middleware = databaseConnectionMiddleware();
      expect(typeof middleware).toBe('function');
    });

    it('returns a new middleware instance on each call', () => {
      const middleware1 = databaseConnectionMiddleware();
      const middleware2 = databaseConnectionMiddleware();
      expect(middleware1).not.toBe(middleware2);
    });
  });
});
