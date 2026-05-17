import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Shared mocks (hoisted by Vitest) ────────────────────────────────────────
import '@/test-utils/controller-mocks';
import {
  createMockResponse,
  createMockNext,
  createMockRequest,
} from '@/test-utils/controller-mocks';

// ── Imports (after mocks) ──────────────────────────────────────────────────

import { endpointDisabledMiddleware } from '@/middlewares/endpoint-disabled.middleware';

describe('endpointDisabledMiddleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DISABLE_TEST_ENDPOINT;
    delete process.env.DISABLE_SERVICE_STATIONS;
    delete process.env.DISABLE_SERVICE_STATIONS_HISTORIC;
    delete process.env.DISABLE_MUNICIPALITIES;
  });

  describe('endpoint disabled', () => {
    it('returns 404 when env var is "true"', () => {
      process.env.DISABLE_TEST_ENDPOINT = 'true';
      const middleware = endpointDisabledMiddleware('DISABLE_TEST_ENDPOINT');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'NOT_FOUND' }),
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 for DISABLE_SERVICE_STATIONS', () => {
      process.env.DISABLE_SERVICE_STATIONS = 'true';
      const middleware = endpointDisabledMiddleware('DISABLE_SERVICE_STATIONS');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 for DISABLE_SERVICE_STATIONS_HISTORIC', () => {
      process.env.DISABLE_SERVICE_STATIONS_HISTORIC = 'true';
      const middleware = endpointDisabledMiddleware('DISABLE_SERVICE_STATIONS_HISTORIC');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 404 for DISABLE_MUNICIPALITIES', () => {
      process.env.DISABLE_MUNICIPALITIES = 'true';
      const middleware = endpointDisabledMiddleware('DISABLE_MUNICIPALITIES');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('endpoint enabled', () => {
    it('calls next() when env var is "false"', () => {
      process.env.DISABLE_TEST_ENDPOINT = 'false';
      const middleware = endpointDisabledMiddleware('DISABLE_TEST_ENDPOINT');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('calls next() when env var is not set', () => {
      delete process.env.DISABLE_TEST_ENDPOINT;
      const middleware = endpointDisabledMiddleware('DISABLE_TEST_ENDPOINT');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('calls next() when env var is set to any value other than "true"', () => {
      process.env.DISABLE_TEST_ENDPOINT = 'yes';
      const middleware = endpointDisabledMiddleware('DISABLE_TEST_ENDPOINT');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when env var is set to empty string', () => {
      process.env.DISABLE_TEST_ENDPOINT = '';
      const middleware = endpointDisabledMiddleware('DISABLE_TEST_ENDPOINT');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
