import { describe, it, expect, vi } from 'vitest';
import {
  createValidationError,
  createBadRequestError,
  createNotFoundError,
  createInternalServerError,
  sendApiError,
  errorStatus,
} from '../error-handler';

describe('createValidationError', () => {
  it('creates a validation error with message only', () => {
    const result = createValidationError('Invalid input');

    expect(result.error.message).toBe('Invalid input');
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  it('includes details when provided', () => {
    const result = createValidationError('Invalid input', { field: 'email' });

    expect(result.error.details).toEqual({ field: 'email' });
  });

  it('sets details to undefined when not provided', () => {
    const result = createValidationError('Invalid input');

    expect(result.error.details).toBeUndefined();
  });

  it('includes details when null', () => {
    const result = createValidationError('Invalid input', null);

    expect(result.error.details).toBeNull();
  });
});

describe('createBadRequestError', () => {
  it('creates a bad request error', () => {
    const result = createBadRequestError('Malformed request');

    expect(result).toEqual({
      error: {
        message: 'Malformed request',
        code: 'BAD_REQUEST',
      },
    });
  });
});

describe('createNotFoundError', () => {
  it('creates a not found error with default message', () => {
    const result = createNotFoundError();

    expect(result).toEqual({
      error: {
        message: 'Not found',
        code: 'NOT_FOUND',
      },
    });
  });

  it('creates a not found error with custom message', () => {
    const result = createNotFoundError('Resource not found');

    expect(result).toEqual({
      error: {
        message: 'Resource not found',
        code: 'NOT_FOUND',
      },
    });
  });
});

describe('createInternalServerError', () => {
  it('creates an internal error with default message in development', () => {
    const result = createInternalServerError();

    expect(result.error.code).toBe('INTERNAL_ERROR');
    expect(result.error.message).toBe('Internal server error');
  });

  it('includes stack trace in development when Error is provided', () => {
    const err = new Error('test error');
    const result = createInternalServerError('Something failed', err);

    expect(result.error.message).toBe('Something failed');
    expect(result.error.details).toBe(err.stack);
  });

  it('excludes details when non-Error is provided', () => {
    const result = createInternalServerError('Something failed', 'string error');

    expect(result.error.message).toBe('Something failed');
    expect(result.error.details).toBeUndefined();
  });

  it('excludes details when undefined is provided', () => {
    const result = createInternalServerError('Something failed', undefined);

    expect(result.error.message).toBe('Something failed');
    expect(result.error.details).toBeUndefined();
  });
});

describe('sendApiError', () => {
  it('sets status code and sends JSON response', () => {
    const mockJson = vi.fn();
    const mockStatus = vi.fn().mockReturnThis();
    const res = {
      status: mockStatus,
      json: mockJson,
    } as any;

    const apiError = { error: { message: 'Not found', code: 'NOT_FOUND' } };

    sendApiError(res, apiError, 404);

    expect(mockStatus).toHaveBeenCalledWith(404);
    expect(mockJson).toHaveBeenCalledWith(apiError);
  });
});

describe('errorStatus', () => {
  it('returns 400 for VALIDATION_ERROR', () => {
    expect(errorStatus('VALIDATION_ERROR')).toBe(400);
  });

  it('returns 400 for BAD_REQUEST', () => {
    expect(errorStatus('BAD_REQUEST')).toBe(400);
  });

  it('returns 404 for NOT_FOUND', () => {
    expect(errorStatus('NOT_FOUND')).toBe(404);
  });

  it('returns 500 for INTERNAL_ERROR', () => {
    expect(errorStatus('INTERNAL_ERROR')).toBe(500);
  });

  it('returns 500 for unknown codes', () => {
    expect(errorStatus('UNKNOWN')).toBe(500);
    expect(errorStatus('')).toBe(500);
  });
});
