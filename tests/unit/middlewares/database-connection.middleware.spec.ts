import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@tests/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@tests/test-utils/controller-mocks';

// ── Seam mock (hoisted by Vitest) ───────────────────────────────────────────
vi.mock('@/infrastructure/persistence/HistoricRepository', () => ({
  historicRepository: {
    isReady: vi.fn(),
    ping: vi.fn(),
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { databaseConnectionMiddleware } from '@/interfaces/http/middlewares/database-connection.middleware';
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';

const mockIsReady = historicRepository.isReady as unknown as ReturnType<typeof vi.fn<() => boolean>>;
const mockPing = historicRepository.ping as unknown as ReturnType<typeof vi.fn<() => Promise<void>>>;

describe('databaseConnectionMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReady.mockReturnValue(true);
    mockPing.mockResolvedValue(undefined);
  });

  describe('historic backend not ready', () => {
    it('returns 500 when historicRepository.isReady() is false', async () => {
      mockIsReady.mockReturnValue(false);
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
      expect(mockPing).not.toHaveBeenCalled();
    });
  });

  describe('successful ping', () => {
    it('calls next() when historicRepository.ping() resolves', async () => {
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(mockIsReady).toHaveBeenCalled();
      expect(mockPing).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('ping failure', () => {
    it('passes error to next() when historicRepository.ping() rejects', async () => {
      mockPing.mockRejectedValue(new Error('Connection refused'));
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(mockPing).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(new Error('Connection refused'));
      expect(res.status).not.toHaveBeenCalled();
    });

    it('passes non-Error rejection to next()', async () => {
      mockPing.mockRejectedValue('String error');
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith('String error');
    });

    it('passes null rejection to next()', async () => {
      mockPing.mockRejectedValue(null);
      const middleware = databaseConnectionMiddleware();
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(null);
    });

    it('passes undefined rejection to next()', async () => {
      mockPing.mockRejectedValue(undefined);
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
