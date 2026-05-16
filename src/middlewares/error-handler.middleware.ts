import type { ErrorRequestHandler } from 'express';
import * as Sentry from '@sentry/node';
import { sentryEnabled } from '@/services/sentry.service';
import { sendApiError, createInternalServerError, errorStatus } from '@/utils/error-handler/error-handler';
import { logger } from '@/utils';

/**
 * Global Express error middleware.
 *
 * Catches any thrown Error (or ApiError shape) and sends a
 * normalized JSON response.  Non-Error values are wrapped in
 * a generic 500 response.
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (err, _req, res, _next): void => {
  // Send to Sentry if enabled
  if (sentryEnabled) {
    Sentry.captureException(err);
  }

  // If err already looks like our ApiError shape, send it directly
  if (err && typeof err === 'object' && 'error' in err) {
    const apiError = err as { error: { message: string; code: string; details?: unknown } };
    const status = errorStatus(apiError.error.code);
    sendApiError(res, apiError, status);
    return;
  }

  // Fallback: wrap unknown errors
  const message = err instanceof Error ? err.message : 'Internal server error';
  logger.error('Unhandled error caught by global middleware', { error: message });
  const apiError = createInternalServerError(message, err instanceof Error ? err : new Error(String(err)));
  sendApiError(res, apiError, 500);
};
