import { NextFunction, Request, Response } from "express";
import { HistoricFuelStation } from "@/models/db/HistoricFuelStation";
import { createInternalServerError, sendApiError } from '@/utils/error-handler';

/**
 * Middleware that validates the database connection before processing the request.
 *
 * Checks that the Sequelize instance is initialized and that the database
 * connection is alive. If either check fails, it short-circuits with a 500 error.
 *
 * @returns An Express middleware function.
 */
export const databaseConnectionMiddleware = () => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!HistoricFuelStation.sequelize) {
      sendApiError(res, createInternalServerError('Database not initialized'), 500);
      return;
    }

    try {
      await HistoricFuelStation.sequelize.authenticate();
      next();
    } catch (error) {
      next(error);
    }
  };
};
