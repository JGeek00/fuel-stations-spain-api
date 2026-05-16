import { NextFunction, Request, Response } from "express";
import { GetMunicipalitiesResponse } from "@/models/out/GetMunicipalitiesResponse.model";
import {
  createInternalServerError,
  sendApiError,
} from '@/utils/error-handler';
import MunicipalitiesRepository from '@/repository/Municipalities.repository';
import { logger } from '@/utils';

export const municipalitiesController = async (req: Request, res: Response<GetMunicipalitiesResponse>, next: NextFunction): Promise<void> => {
  try {
    if (process.env.DISABLE_MUNICIPALITIES == "true") {
      throw createInternalServerError('Endpoint not found');
    }

    const data = MunicipalitiesRepository.data
    res.send({
      municipalities: data
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'error' in error) {
      const apiError = error as { error: { message: string; code: string; details?: unknown }; code?: string };
      const status = apiError.error.code === 'NOT_FOUND'
        ? 404
        : apiError.error.code === 'INTERNAL_ERROR'
          ? 500
          : 500;
      sendApiError(res, apiError, status);
    } else {
      logger.error('Unexpected error in municipalities endpoint', { error: error instanceof Error ? error.message : String(error) });
      next(createInternalServerError('Internal server error', error instanceof Error ? error : undefined));
    }
  }
}
