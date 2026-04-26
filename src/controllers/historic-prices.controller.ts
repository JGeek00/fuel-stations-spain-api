import { Request, Response } from "express";
import { query } from "express-validator";
import { DateTime, Interval } from 'luxon';
import * as Sentry from '@sentry/node'
import { Op } from "sequelize";
import { HistoricFuelStation } from "@/models/HistoricFuelStation";
import { FuelStation } from "@/models/FuelStation";
import { HistoricPrice } from "@/interfaces/HistoricPrice.model";
import { keysToCamel } from "@/utils/case-keys";

export const historicPricesValidations = [
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
  query('includeCurrentPrices').optional().isBoolean().withMessage('includeCurrentPrices must be a boolean')
];

export const historicPricesController = async (req: Request, res: Response): Promise<void> => {
  if (process.env.DISABLE_SERVICE_STATIONS_HISTORIC == "true") {
    res.status(404).send("Endpoint not found")
    return
  }

  try {
    if (!HistoricFuelStation.sequelize) throw new Error("Database not initialized")
    await HistoricFuelStation.sequelize.authenticate();
  } catch (error) {
    Sentry.captureException(error);
    res.status(500).send("Historic data is not available.");
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
    const stationId = Array.isArray(req.query.id) ? req.query.id[0] : (req.query.id as string)
    const historicResult = await HistoricFuelStation.findAll({
      where: {
        station_id: stationId,
        date: {
          [Op.between]: [startDate.toSQLDate(), endDate.toSQLDate()]
        }
      },
      order: [
        ['date', 'ASC'],
      ],
      attributes: { exclude: ['id'] }
    })

    let currentPrices: FuelStation | null = null;
    if (req.query.includeCurrentPrices && req.query.includeCurrentPrices != 'false') {
      currentPrices = await FuelStation.findOne({
        where: {
          id: stationId
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
    console.error(error);
    Sentry.captureException(error);
    res.sendStatus(500);
  }
}