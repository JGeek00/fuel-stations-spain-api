import { NextFunction, Request, Response } from "express";
import { historicRepository } from '@/infrastructure/persistence/HistoricRepository';
import { createInternalServerError, sendApiError } from '@/shared/errors/error-handler';

/**
 * Middleware that validates the database connection before processing the request.
 *
 * Checks that the persisted backend is initialized and alive via the
 * HistoricRepository seam. If either check fails, it short-circuits with a 500 error.
 *
 * @returns An Express middleware function.
 */
export const databaseConnectionMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!historicRepository.isReady()) {
      sendApiError(res, createInternalServerError('Database not initialized'), 500);
      return;
    }

    try {
      await historicRepository.ping();
      next();
    } catch (error) {
      next(error);
    }
  };
};
