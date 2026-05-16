import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Stub Sentry before importing middleware
vi.mock('@sentry/node', () => ({
  captureException: vi.fn(),
}));
vi.mock('@/services/sentry/sentry.service', () => ({
  sentryEnabled: false,
}));
vi.mock('@/utils', () => ({
  logger: {
    error: vi.fn(),
  },
  createInternalServerError: vi.fn((message, _error) => ({
    error: { message, code: 'INTERNAL_ERROR' },
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

import * as Sentry from '@sentry/node';
import { errorHandlerMiddleware } from '../error-handler.middleware';
import { logger } from '../../utils';

const mockSentryCaptureException = vi.mocked(Sentry.captureException);
const mockLoggerError = vi.mocked(logger.error);

function createMockRequest(): Request {
  return {} as unknown as Request;
}

function createMockResponse(): Response {
  const statusSpy = vi.fn().mockReturnThis();
  const jsonSpy = vi.fn().mockReturnThis();
  return {
    status: statusSpy,
    json: jsonSpy,
    send: vi.fn(),
  } as unknown as Response;
}

function createMockNext(): NextFunction {
  return vi.fn();
}

describe('errorHandlerMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApiError shape detection', () => {
    it('handles an error with ApiError shape (VALIDATION_ERROR)', () => {
      const err = {
        error: {
          message: 'Invalid email format',
          code: 'VALIDATION_ERROR',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(err);
    });

    it('handles an error with ApiError shape (NOT_FOUND)', () => {
      const err = {
        error: {
          message: 'Resource not found',
          code: 'NOT_FOUND',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(err);
    });

    it('handles an error with ApiError shape (INTERNAL_ERROR)', () => {
      const err = {
        error: {
          message: 'Something went wrong',
          code: 'INTERNAL_ERROR',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(err);
    });

    it('handles an error with ApiError shape (BAD_REQUEST)', () => {
      const err = {
        error: {
          message: 'Bad request',
          code: 'BAD_REQUEST',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(err);
    });

    it('handles an error with an unknown error code (defaults to 500)', () => {
      const err = {
        error: {
          message: 'Unknown error',
          code: 'UNKNOWN_ERROR',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(err);
    });

    it('handles an ApiError with details field', () => {
      const err = {
        error: {
          message: 'Invalid input',
          code: 'VALIDATION_ERROR',
          details: { field: 'email' },
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(err);
    });
  });

  describe('Standard Error handling', () => {
    it('wraps a standard Error in an INTERNAL_ERROR response', () => {
      const err = new Error('Database connection failed');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'Unhandled error caught by global middleware',
        { error: 'Database connection failed' },
      );
    });

    it('preserves the Error message in the response', () => {
      const err = new Error('Specific failure message');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.error.message).toBe('Specific failure message');
      expect(jsonCall.error.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('Non-Error value handling', () => {
    it('handles a string thrown as error', () => {
      const err = 'Something broke';
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      const jsonCall = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(jsonCall.error.message).toBe('Internal server error');
      expect(jsonCall.error.code).toBe('INTERNAL_ERROR');
    });

    it('handles null as error', () => {
      const err = null;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles a number as error', () => {
      const err = 42;
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('handles an object without "error" key', () => {
      const err = { foo: 'bar' };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('Sentry integration', () => {
    it('does not call Sentry.captureException when sentryEnabled is false', () => {
      // sentryEnabled is mocked to false in vi.mock above
      const err = new Error('Test error');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(mockSentryCaptureException).not.toHaveBeenCalled();
    });
  });

  describe('next is not called', () => {
    it('does not call next() for ApiError', () => {
      const err = {
        error: {
          message: 'Not found',
          code: 'NOT_FOUND',
        },
      };
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(next).not.toHaveBeenCalled();
    });

    it('does not call next() for standard Error', () => {
      const err = new Error('Test');
      const req = createMockRequest();
      const res = createMockResponse();
      const next = createMockNext();

      errorHandlerMiddleware(err, req, res, next);

      expect(next).not.toHaveBeenCalled();
    });
  });
});
