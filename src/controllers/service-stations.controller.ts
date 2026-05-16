import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { Op } from "sequelize";
import * as Sentry from '@sentry/node'
import { FuelStationsTable } from "@/models/db/FuelStations";
import config from '@/config/config.json'
import { calculateBoundingBox, logger } from '@/utils';
import { LastUpdated } from "@/models/db/LastUpdated";
import { GetFuelStationsQueryParams } from "@/models/in/GetFuelStationsQueryParams.model";
import {
  createValidationError,
  createBadRequestError,
  createInternalServerError,
  sendApiError,
} from '@/utils/error-handler';

export const serviceStationsController = async (req: Request<{}, {}, {}, GetFuelStationsQueryParams>, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (process.env.DISABLE_SERVICE_STATIONS == "true") {
      throw createBadRequestError('Endpoint not found');
    }

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

    let where = {}

    if (req.query.municipalityId) {
      where = {
        municipalityId: req.query.municipalityId
      }
    }

    // If coordinates and distance are defined search by them
    if (req.query.coordinates) {
      const [latitude, longitude] = req.query.coordinates.split(',');

      let distance = req.query.distance ? req.query.distance : config.defaults.query.distance
      distance = distance > config.maximums.query.distance ? config.maximums.query.distance : distance
      distance = distance < config.minimums.query.distance ? config.minimums.query.distance : distance

      const { minLat, maxLat, minLon, maxLon } = calculateBoundingBox(parseFloat(latitude), parseFloat(longitude), distance)
      where = {
        latitude: {
          [Op.between]: [minLat, maxLat]
        },
        longitude: {
          [Op.between]: [minLon, maxLon]
        },
      }
    }

    // If ids are defined that should be the only filter on where
    if (req.query.id) {
      const ids = Array.isArray(req.query.id) ? req.query.id : [req.query.id];
      where = {
        stationId: {
          [Op.in]: ids
        }
      }
    }

    const { rows: results, count } = await FuelStationsTable.findAndCountAll({
      limit,
      offset,
      where
    })

    // Set return stationId value as id
    const mappedResults = results.map(r => ({
      ...r.dataValues,
      stationId: undefined,
      id: r.dataValues.stationId
    }))

    const lastUpdated = await LastUpdated.findAll()

    res.json({
      lastUpdated: lastUpdated[0].getDataValue("lastUpdated"),
      count,
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
