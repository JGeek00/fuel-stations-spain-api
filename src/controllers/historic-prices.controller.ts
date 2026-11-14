import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { DateTime } from 'luxon';
import * as Sentry from '@sentry/node'
import { and, asc, between, eq } from "drizzle-orm";
import { fuelStationsTable, getMemoryDb, getPersistedDb, historicFuelStationsTable, installHistoricFuelStationAdapter } from "@/models/db/memory-db";
import { pgHistoricData } from "@/models/db/HistoricFuelStation";
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
import { logger } from '@/utils/logger';
import { formatRange, getHistoricDataMaxRangeMonths } from "@/utils/historic-data-limit";

// The historic e2e seeds rows through the HistoricFuelStation statics; the
// adapter routes them to the shared memory DB this controller reads. Drop the
// install when the persisted side moves to Drizzle pg (T6).
installHistoricFuelStationAdapter();

export const historicPricesController = async (req: Request<{}, {}, {}, GetHistoricPricesQueryParams>, res: Response<GetHistoricPricesResponse>, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw createValidationError('Validation failed', errors.array());
    }

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

    if (isNaN(end.diff(start).as('days'))) {
      throw createBadRequestError('startDate must be an earlier date than endDate');
    }

    const maxRangeMonths = getHistoricDataMaxRangeMonths();
    if (maxRangeMonths !== null && end.diff(start).as('months') > maxRangeMonths) {
      throw createBadRequestError(`The maximum difference between the dates cannot be greater than ${formatRange(maxRangeMonths)}`);
    }

    const stationId = Array.isArray(req.query.id) ? req.query.id[0] : (req.query.id as string)
    // PG when configured, memory fallback for e2e/tests without PG (S1: same output).
    const persisted = getPersistedDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = persisted ?? getMemoryDb();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const h: any = persisted ? pgHistoricData : historicFuelStationsTable;
    const historicResult = await db
      .select({
        stationId: h.stationId,
        stationSignage: h.stationSignage,
        adbluePrice: h.adbluePrice,
        ammoniaPrice: h.ammoniaPrice,
        biodieselPrice: h.biodieselPrice,
        bioethanolPrice: h.bioethanolPrice,
        compressedBiogasPrice: h.compressedBiogasPrice,
        liquefiedBiogasPrice: h.liquefiedBiogasPrice,
        renewableDieselPrice: h.renewableDieselPrice,
        cngPrice: h.cngPrice,
        lngPrice: h.lngPrice,
        lpgPrice: h.lpgPrice,
        gasoilAPrice: h.gasoilAPrice,
        gasoilBPrice: h.gasoilBPrice,
        premiumGasoilPrice: h.premiumGasoilPrice,
        gasoline95E10Price: h.gasoline95E10Price,
        gasoline95E25Price: h.gasoline95E25Price,
        gasoline95E5Price: h.gasoline95E5Price,
        gasoline95E5PremiumPrice: h.gasoline95E5PremiumPrice,
        gasoline95E85Price: h.gasoline95E85Price,
        gasoline98E10Price: h.gasoline98E10Price,
        gasoline98E5Price: h.gasoline98E5Price,
        renewableGasolinePrice: h.renewableGasolinePrice,
        hydrogenPrice: h.hydrogenPrice,
        methanolPrice: h.methanolPrice,
        date: h.date,
      })
      .from(h)
      .where(and(
        eq(h.stationId, stationId),
        between(h.date, start.toSQLDate() as string, end.toSQLDate() as string)
      ))
      .orderBy(asc(h.date))

    let currentPrices: Record<string, unknown> | null = null;
    const includeCurrentPrices = !!req.query.includeCurrentPrices;
    if (includeCurrentPrices) {
      const currentRows = await getMemoryDb()
        .select()
        .from(fuelStationsTable)
        .where(eq(fuelStationsTable.stationId, stationId))
        .limit(1)
      currentPrices = currentRows[0] ?? null
    }

    const formattedHistoric = historicResult.map((e: Record<string, unknown>) => {
      const values = keysToCamel(e)
      return <HistoricPrice>values
    })

    if (currentPrices) {
      const values = keysToCamel(currentPrices)
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
      logger.error('Unexpected error in historic-prices endpoint', { error: error instanceof Error ? error.message : String(error) });
      next(createInternalServerError('Internal server error', error instanceof Error ? error : undefined));
    }
  }
}
