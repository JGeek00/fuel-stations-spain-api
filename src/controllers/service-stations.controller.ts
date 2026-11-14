import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import * as Sentry from '@sentry/node'
import { and, between, count, eq, inArray, type SQL } from "drizzle-orm";
import config from '@/config/config.json'
import { logger } from '@/utils/logger';
import { fuelStationsTable, getMemoryDb, lastUpdatedTable } from "@/models/db/memory-db";
import { GetFuelStationsQueryParams } from "@/models/in/GetFuelStationsQueryParams.model";
import {
  createValidationError,
  createBadRequestError,
  createInternalServerError,
  sendApiError,
} from '@/utils/error-handler';
import { calculateBoundingBox } from "@/utils/calculate-distance";

export const serviceStationsController = async (req: Request<{}, {}, {}, GetFuelStationsQueryParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      throw createValidationError('Validation failed', errors.array());
    }

    if (req.query.distance && !req.query.coordinates) {
      throw createValidationError('If the distance parameter is defined, the coordinates parameter is also required');
    }

    let limit = undefined
    let offset = undefined

    // Use limit and offset only when no specific stations are searched and when not searching by coordinates
    if (!req.query.id && !req.query.coordinates && !req.query.distance && !req.query.municipalityId) {

      limit = req.query.limit ? req.query.limit : config.defaults.query.limit
      offset = req.query.offset ? req.query.offset : config.defaults.query.offset

      if (offset >= limit) {
        throw createBadRequestError('Offset must be lower than limit');
      }

      limit = limit - offset > config.maximums.query.amount ? offset + config.maximums.query.amount : limit
    }

    let where: SQL | undefined

    if (req.query.municipalityId) {
      where = eq(fuelStationsTable.municipalityId, req.query.municipalityId)
    }

    // If coordinates and distance are defined search by them
    if (req.query.coordinates) {
      const [latitude, longitude] = req.query.coordinates.split(',');

      let distance = req.query.distance ? req.query.distance : config.defaults.query.distance
      distance = distance > config.maximums.query.distance ? config.maximums.query.distance : distance
      distance = distance < config.minimums.query.distance ? config.minimums.query.distance : distance

      const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(parseFloat(latitude), parseFloat(longitude), distance)
      where = and(
        between(fuelStationsTable.latitude, minLat, maxLat),
        between(fuelStationsTable.longitude, minLon, maxLon)
      )
    }

    // If ids are defined that should be the only filter on where
    if (req.query.id) {
      const ids = Array.isArray(req.query.id) ? req.query.id : [req.query.id];
      where = inArray(fuelStationsTable.stationId, ids)
    }

    const db = getMemoryDb()
    let query = db.select().from(fuelStationsTable).where(where)
    if (limit !== undefined) {
      // Query params arrive as strings; sqlite rejects a text bind in LIMIT/OFFSET.
      query = query.limit(Number(limit))
    }
    if (offset !== undefined) {
      query = query.offset(Number(offset))
    }
    const results = await query

    const [countRow] = await db.select({ value: count() }).from(fuelStationsTable).where(where)

    // Set return stationId value as id
    const mappedResults = results.map((r: Record<string, unknown>) => ({
      ...r,
      stationId: undefined,
      id: r.stationId
    }))

    const lastUpdatedRows = await db.select().from(lastUpdatedTable)

    res.json({
      lastUpdated: lastUpdatedRows[0].lastUpdated,
      count: countRow.value,
      results: mappedResults,
    })
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
