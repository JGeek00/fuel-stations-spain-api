import { Request, Response } from "express";
import { query, validationResult } from "express-validator";
import { FuelStation } from "@/models/db/fuel-station";
import defaults from '@/config/defaults.json'

export const serviceStationsValidations = [
  query('limit').isInt().optional().withMessage('Limit parameter must be an int value'),
  query('offset').isInt().optional().withMessage('Offset parameter must be an int value'),
  query('id')
    .custom(value => {
      if (typeof value === 'string') {
        return true;
      }
      if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
        return true;
      }
      throw new Error('Id must be a string or an array of strings');
    })
];

export const serviceStationsController = async (req: Request, res: Response) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : defaults.query.limit
    const offset = req.query.offset ? parseInt(req.query.offset as string) : defaults.query.offset

    let where = {}
    if (req.query.id) {
      where = {
        ...where,
        id: req.query.id
      }
    }

    const results = await FuelStation.findAll({
      limit: !req.query.id ? limit : undefined,
      offset: !req.query.id ? offset : undefined,
      where
    })
    res.json(results)
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
}