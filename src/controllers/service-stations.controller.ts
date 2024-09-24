import { Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { Op } from "sequelize";
import { FuelStation } from "@/models/db/fuel-station";
import defaults from '@/config/defaults.json'
import { calculateBoundingBox } from '@/utils/calculate-distance';

export const serviceStationsValidations = [
  query('limit').isInt().optional().withMessage('Limit parameter must be an int value'),
  query('offset').isInt().optional().withMessage('Offset parameter must be an int value'),
  query('id')
    .optional()
    .custom(value => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        return true;
      }
      throw new Error('Id must be a string or an array of strings');
    }),
  query('coordinates')
    .optional()
    .custom((value) => {
      const [latitude, longitude] = value.split(',');
      if (!latitude || !longitude) {
        throw new Error('Both latitude and longitude are required');
      }
      const lat = parseFloat(latitude);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a number between -90 and 90');
      }
      const lon = parseFloat(longitude);
      if (isNaN(lon) || lon < -180 || lon > 180) {
        throw new Error('Longitude must be a number between -180 and 180');
      }
      return true;
    }),
  query('distance').isInt().optional().withMessage("Distance must be a number (min 10 Km, max 50 Km)")
];

export const serviceStationsController = async (req: Request, res: Response) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    let limit = undefined
    let offset = undefined

    // Use limit and offset only when no specific stations are searched and when not searching by coordinates
    if (!req.query.id && !req.query.coordinates && !req.query.distance) {
      limit = req.query.limit ? parseInt(req.query.limit as string) : defaults.query.limit
      offset = req.query.offset ? parseInt(req.query.offset as string) : defaults.query.offset
    }

    let where = {}

    // If coordinates and distance are defined search by them
    if (req.query.coordinates) {
      const [latitude, longitude] = (req.query.coordinates as string).split(',');

      let distance = req.query.distance ? parseInt(req.query.distance as string) : defaults.query.distance
      distance = distance > 50 ? 50 : distance
      distance = distance < 10 ? 10 : distance

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
      where = {
        id: req.query.id
      }
    }

    const results = await FuelStation.findAll({
      limit,
      offset,
      where
    })
    res.json(results)
  } catch (error) {
    res.sendStatus(500)
  }
}