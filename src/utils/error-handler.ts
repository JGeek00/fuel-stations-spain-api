import type { Response } from 'express';
import type { ApiError } from '@/models/out/ErrorResponse.model';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Creates a validation error (400).
 * Use for express-validator results or business validation failures.
 */
export function createValidationError(message: string, details?: unknown): ApiError {
  return {
    error: {
      message,
      code: 'VALIDATION_ERROR',
      details: details !== undefined ? details : undefined,
    },
  };
}

/**
 * Creates a bad request error (400).
 * Use for malformed requests (e.g., offset >= limit).
 */
export function createBadRequestError(message: string): ApiError {
  return {
    error: {
      message,
      code: 'BAD_REQUEST',
    },
  };
}

/**
 * Creates a not found error (404).
 */
export function createNotFoundError(message = 'Not found'): ApiError {
  return {
    error: {
      message,
      code: 'NOT_FOUND',
    },
  };
}

/**
 * Creates an internal server error (500).
 * In development mode, includes the stack trace in details.
 */
export function createInternalServerError(message = 'Internal server error', error?: unknown): ApiError {
  const apiError: ApiError = {
    error: {
      message: isDevelopment ? message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  };

  if (isDevelopment && error instanceof Error) {
    apiError.error.details = error.stack;
  }

  return apiError;
}

/**
 * Sends a normalized API error response.
 */
export function sendApiError(res: Response, apiError: ApiError, statusCode: number): void {
  res.status(statusCode).json(apiError);
}

/**
 * Extracts the HTTP status code for a given error code.
 */
export function errorStatus(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      return 400;
    case 'NOT_FOUND':
      return 404;
    case 'INTERNAL_ERROR':
      return 500;
    default:
      return 500;
  }
}
