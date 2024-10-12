import { Request, Response } from "express";
import { query } from "express-validator";
import { DateTime, Interval } from 'luxon';
import * as Sentry from '@sentry/node'
import { Op } from "sequelize";
import persistedDatabase from "@/services/persisted-database";
import { HistoricFuelStation } from "@/models/db/historic-fuel-station";

export const serviceStationsHistoricValidations = [
  query('id')
    .exists().withMessage('The id parameter is required')
    .bail()
    .custom((_, { req }) => {
      if (Array.isArray(req.query?.id)) {
        throw new Error('Only one id parameter is allowed');
      }
      return true;
    }),
  query('startDate').exists().isDate({ format: "yyyy-mm-dd" }).withMessage('The startDate parameter is required and must be a date with format yyyy-mm-dd'),
  query('endDate').exists().isDate({ format: "yyyy-mm-dd" }).withMessage('The endDate parameter is required and must be a date yyyy-mm-dd'),
];

export const serviceStationsHistoricController = async (req: Request, res: Response) => {
  if (process.env.DISABLE_SERVICE_STATIONS_HISTORIC == "true") {
    res.status(404).send("Endpoint not found")
    return
  }    

  if (!persistedDatabase.instance) {
    res.status(500).send("Endpoint not available")
    return
  }

  try {
    DateTime.fromSQL(req.query.startDate as string)
  } catch (error) {
    res.status(400).send("Invalid format for startDate. Must be yyyy-mm-dd.")
    return
  }

  try {
    DateTime.fromSQL(req.query.endDate as string)
  } catch (error) {
    res.status(400).send("Invalid format for endDate. Must be yyyy-mm-dd.")
    return
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const startDate = DateTime.fromSQL(req.query.startDate as string).setZone(timezone)
  const endDate = DateTime.fromSQL(req.query.endDate as string).setZone(timezone)
  if (isNaN(Interval.fromDateTimes(startDate, endDate).length('days'))) {
    res.status(400).send("startDate must be an earlier date than endDate")
    return
  }
  if (Interval.fromDateTimes(startDate, endDate).length('years') > 1) {
    res.status(400).send("The maximum difference between the dates cannot be greater than 1 year")
    return
  }

  try {
    const result = await HistoricFuelStation.findAll({
      where: {
        station_id: req.query.id,
        date: {
          [Op.between]: [startDate.toSQLDate(), endDate.toSQLDate()]
        }
      },
      order: [
        ['date', 'ASC'],
      ],
      attributes: { exclude: ['id'] }
    })
    res.json(result)
  } catch (error) {
    Sentry.captureException(error)
    res.sendStatus(500)
  }
}