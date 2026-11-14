import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import * as Sentry from '@sentry/node'
import { GetHistoricPricesQueryParams } from "@/models/in/GetHistoricPricesQueryParams.model";
import { GetHistoricPricesResponse } from "@/models/out/GetHistoricPricesResponse.model";
import {
  createValidationError,
  createInternalServerError,
  sendApiError,
} from '@/utils/error-handler';
import { logger } from '@/utils/logger';
import { getHistoricPricesUseCase } from '@/application/usecases/GetHistoricPrices.usecase';

export const historicPricesController = async (req: Request<{}, {}, {}, GetHistoricPricesQueryParams>, res: Response<GetHistoricPricesResponse>, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw createValidationError('Validation failed', errors.array());
    }

    const result = await getHistoricPricesUseCase({
      id: req.query.id as string | string[],
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      includeCurrentPrices: req.query.includeCurrentPrices,
    });

    res.json(result);
  } catch (error) {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = error as { error: { message: string; code: string; details?: unknown } };
      const status = apiError.error.code === 'VALIDATION_ERROR' || apiError.error.code === 'BAD_REQUEST'
        ? 400
        : apiError.error.code === 'NOT_FOUND'
          ? 404
          : 500;
      sendApiError(res, apiError, status);
    } else {
      Sentry.captureException(error);
      logger.error('Unexpected error in historic-prices endpoint', { error: error instanceof Error ? error.message : String(error) });
      next(createInternalServerError('Internal server error', error instanceof Error ? error : undefined));
    }
  }
}
