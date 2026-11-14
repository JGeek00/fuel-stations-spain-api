import { NextFunction, Request, Response } from "express";
import { GetMunicipalitiesResponse } from "@/interfaces/http/dto/out/GetMunicipalitiesResponse.model";
import {
  createInternalServerError,
  sendApiError,
} from '@/shared/errors/error-handler';
import { logger } from '@/shared/utils/logger';
import { listMunicipalitiesUseCase } from '@/application/usecases/ListMunicipalities.usecase';

export const municipalitiesController = async (_req: Request, res: Response<GetMunicipalitiesResponse>, next: NextFunction): Promise<void> => {
  try {
    const data = listMunicipalitiesUseCase().municipalities;
    res.send({
      municipalities: data as unknown as GetMunicipalitiesResponse['municipalities'],
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
