import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Stub modules before importing middleware
vi.mock('@/utils/mcp', () => ({
  parseCsvEnv: vi.fn(),
}));
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { mcpSecurityMiddleware } from '@/middlewares/mcp-security.middleware';
import { parseCsvEnv } from '@/utils/mcp';
import { logger } from '@/utils/logger';

const mockParseCsvEnv = vi.mocked(parseCsvEnv);
const mockLoggerWarn = vi.mocked(logger.warn);

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as Request;
}

function createMockResponse(): Response {
  const jsonSpy = vi.fn().mockReturnThis();
  return {
    status: vi.fn().mockReturnThis(),
    json: jsonSpy,
    send: vi.fn(),
  } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('mcpSecurityMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when security is disabled', () => {
    it('calls next() when both allowedOrigins and allowedHosts are empty', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('Origin validation', () => {
    it('allows request with valid Origin in allowlist', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000']);
      const req = createMockRequest({ headers: { origin: 'http://localhost:3000' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows request with wildcard origin', () => {
      mockParseCsvEnv.mockReturnValue(['*']);
      const req = createMockRequest({ headers: { origin: 'http://any-domain.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects request with invalid Origin (403)', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000']);
      const req = createMockRequest({ headers: { origin: 'http://evil.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: -32000,
        message: 'Invalid Origin header: http://evil.com',
      });
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('skips Origin validation when no Origin header is present', () => {
      mockParseCsvEnv.mockReturnValue(['http://localhost:3000']);
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('skips Origin validation when allowedOrigins is empty', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ headers: { origin: 'http://evil.com' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      // Should pass since allowedOrigins is empty
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Host validation', () => {
    it('allows request with valid Host in allowlist', () => {
      mockParseCsvEnv.mockReturnValue(['localhost:3000']);
      const req = createMockRequest({ headers: { host: 'localhost:3000' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('allows request with wildcard host', () => {
      mockParseCsvEnv.mockReturnValue(['*']);
      const req = createMockRequest({ headers: { host: 'any-host:8080' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects request with invalid Host (403)', () => {
      mockParseCsvEnv.mockReturnValue(['localhost:3000']);
      const req = createMockRequest({ headers: { host: 'evil.com:80' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: -32000,
        message: 'Invalid Host header: evil.com:80',
      });
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('skips Host validation when no Host header is present', () => {
      mockParseCsvEnv.mockReturnValue(['localhost:3000']);
      const req = createMockRequest({ headers: {} });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('skips Host validation when allowedHosts is empty', () => {
      mockParseCsvEnv.mockReturnValue([]);
      const req = createMockRequest({ headers: { host: 'evil.com:80' } });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('Origin and Host combined', () => {
    it('validates both Origin and Host when both are configured', () => {
      // First call for allowedOrigins, second for allowedHosts
      mockParseCsvEnv
        .mockReturnValueOnce(['http://localhost:3000'])
        .mockReturnValueOnce(['localhost:3000']);
      const req = createMockRequest({
        headers: {
          origin: 'http://localhost:3000',
          host: 'localhost:3000',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('rejects if Origin is invalid even when Host is valid', () => {
      mockParseCsvEnv
        .mockReturnValueOnce(['http://localhost:3000'])
        .mockReturnValueOnce(['localhost:3000']);
      const req = createMockRequest({
        headers: {
          origin: 'http://evil.com',
          host: 'localhost:3000',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: -32000,
        message: 'Invalid Origin header: http://evil.com',
      });
    });

    it('rejects if Host is invalid even when Origin is valid', () => {
      mockParseCsvEnv
        .mockReturnValueOnce(['http://localhost:3000'])
        .mockReturnValueOnce(['localhost:3000']);
      const req = createMockRequest({
        headers: {
          origin: 'http://localhost:3000',
          host: 'evil.com:80',
        },
      });
      const res = createMockResponse();
      const next = createMockNext();

      mcpSecurityMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: -32000,
        message: 'Invalid Host header: evil.com:80',
      });
    });
  });
});
