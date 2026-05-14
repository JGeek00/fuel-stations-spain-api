import { NextFunction, Request, Response } from "express";
import { DateTime, Interval } from 'luxon';
import * as Sentry from '@sentry/node'
import { Op } from "sequelize";
import { HistoricFuelStation } from "@/models/db/HistoricFuelStation";
import { FuelStationsTable } from "@/models/db/FuelStations";
import { HistoricPrice } from "@/models/entities/HistoricPrice.model";
import { GetHistoricPricesQueryParams } from "@/models/in/GetHistoricPricesQueryParams.model";
import { GetHistoricPricesResponse } from "@/models/out/GetHistoricPricesResponse.model";
import { keysToCamel } from "@/utils/case-keys";
import {
  createValidationError,
  createBadRequestError,
  createInternalServerError,
  sendApiError,
} from '@/utils/error-handler';

export const historicPricesController = async (req: Request<{}, {}, {}, GetHistoricPricesQueryParams>, res: Response<GetHistoricPricesResponse>, next: NextFunction): Promise<void> => {
  try {
    if (process.env.DISABLE_SERVICE_STATIONS_HISTORIC == "true") {
      throw createBadRequestError('Endpoint not found');
    }

    if (!HistoricFuelStation.sequelize) {
      throw createInternalServerError('Database not initialized');
    }

    await HistoricFuelStation.sequelize.authenticate();

    let startDate: DateTime;
    try {
      startDate = DateTime.fromSQL(req.query.startDate as string);
    } catch {
      throw createValidationError('Invalid format for startDate. Must be yyyy-mm-dd.');
    }

    let endDate: DateTime;
    try {
      endDate = DateTime.fromSQL(req.query.endDate as string);
    } catch {
      throw createValidationError('Invalid format for endDate. Must be yyyy-mm-dd.');
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const start = startDate.setZone(timezone)
    const end = endDate.setZone(timezone)

    if (isNaN(Interval.fromDateTimes(start, end).length('days'))) {
      throw createBadRequestError('startDate must be an earlier date than endDate');
    }

    if (Interval.fromDateTimes(start, end).length('years') > 1) {
      throw createBadRequestError('The maximum difference between the dates cannot be greater than 1 year');
    }

    const stationId = Array.isArray(req.query.id) ? req.query.id[0] : (req.query.id as string)
    const historicResult = await HistoricFuelStation.findAll({
      where: {
        station_id: stationId,
        date: {
          [Op.between]: [start.toSQLDate() as string, end.toSQLDate() as string]
        }
      },
      order: [
        ['date', 'ASC'],
      ],
      attributes: { exclude: ['id'] }
    })

    let currentPrices: FuelStationsTable | null = null;
    const includeCurrentPrices = !!req.query.includeCurrentPrices;
    if (includeCurrentPrices) {
      currentPrices = await FuelStationsTable.findOne({
        where: {
          stationId: stationId
        }
      })
    }

    const formattedHistoric = historicResult.map(e => {
      const values = keysToCamel(e.get())
      return <HistoricPrice>values
    })

    if (currentPrices) {
      const values = keysToCamel(currentPrices.get())
      formattedHistoric.push(<HistoricPrice>{
        ...values,
        stationId: (values.id ?? values.stationId) ?? null,
        stationSignage: (values.signage ?? values.stationSignage) ?? null,
        date: DateTime.now().toSQLDate()
      })
    }

    res.json(formattedHistoric);
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
      next(createInternalServerError('Internal server error', error instanceof Error ? error : undefined));
    }
  }
}
