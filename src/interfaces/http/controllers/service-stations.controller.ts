import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import * as Sentry from '@sentry/node'
import { logger } from '@/shared/utils/logger';
import { GetFuelStationsQueryParams } from "@/interfaces/http/dto/in/GetFuelStationsQueryParams.model";
import {
  createValidationError,
  createInternalServerError,
  sendApiError,
} from '@/shared/errors/error-handler';
import { getStationsUseCase } from '@/application/usecases/GetStations.usecase';

export const serviceStationsController = async (req: Request<{}, {}, {}, GetFuelStationsQueryParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw createValidationError('Validation failed', errors.array());
    }

    const result = await getStationsUseCase({
      limit: req.query.limit,
      offset: req.query.offset,
      municipalityId: req.query.municipalityId,
      id: req.query.id,
      coordinates: req.query.coordinates,
      distance: req.query.distance,
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
      logger.error('Unexpected error in service-stations endpoint', { error: error instanceof Error ? error.message : String(error) });
      next(createInternalServerError('Internal server error', error instanceof Error ? error : undefined));
    }
  }
}
