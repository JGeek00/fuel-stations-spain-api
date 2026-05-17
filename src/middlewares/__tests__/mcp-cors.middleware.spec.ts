import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Stub @/utils/mcp before importing middleware
vi.mock('@/utils/mcp', () => ({
  parseCsvEnv: vi.fn(),
}));

import { mcpCorsMiddleware } from '../mcp-cors.middleware';
import { parseCsvEnv } from '../../utils/mcp';

const mockParseCsvEnv = vi.mocked(parseCsvEnv);

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response {
  const setHeaderSpy = vi.fn();
  const sendStatusSpy = vi.fn();
  return {
    setHeader: setHeaderSpy,
    sendStatus: sendStatusSpy,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn(),
  } as unknown as Response & {
    setHeader: ReturnType<typeof vi.fn>;
    sendStatus: ReturnType<typeof vi.fn>;
  };
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('mcpCorsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CORS headers', () => {
    it('sets Access-Control-Allow-Origin to * when no allowed origins configured', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ headers: { origin: 'http://example.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('sets Access-Control-Allow-Origin to * when wildcard is configured', () => {
      mockParseCsvEnv.mockReturnValue(['*']);
      const req = createMockRequest({ headers: { origin: 'http://example.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('reflects the request Origin when it is in the allowlist', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000', 'http://example.com']);
      const req = createMockRequest({ headers: { origin: 'http://example.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', 'http://example.com');
    });

    it('sets Access-Control-Allow-Origin to * when Origin is not in the allowlist', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000']);
      const req = createMockRequest({ headers: { origin: 'http://evil.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    });

    it('sets Access-Control-Allow-Headers correctly', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Headers',
        'Content-Type, MCP-Session-Id, Accept',
      );
    });

    it('sets Access-Control-Expose-Headers correctly', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Expose-Headers',
        'MCP-Session-Id',
      );
    });

    it('sets Access-Control-Allow-Methods correctly', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Methods',
        'GET, POST, DELETE, OPTIONS',
      );
    });
  });

  describe('OPTIONS preflight handling', () => {
    it('responds with 204 for OPTIONS requests', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ method: 'OPTIONS' });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.sendStatus).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for non-OPTIONS requests', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ method: 'GET' });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.sendStatus).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('calls next() for POST requests', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ method: 'POST' });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Origin reflection edge cases', () => {
    it('handles missing Origin header with allowlist configured', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000']);
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
      expect(next).toHaveBeenCalled();
    });

    it('handles multiple allowed origins correctly', () => {
      mockParseCsvEnv.mockReturnValue([
        'http://localhost:3000',
        'http://example.com',
        'https://app.example.com',
      ]);
      const req = createMockRequest({ headers: { origin: 'https://app.example.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpCorsMiddleware(req, res, next);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Access-Control-Allow-Origin',
        'https://app.example.com',
      );
      expect(next).toHaveBeenCalled();
    });
  });
});
