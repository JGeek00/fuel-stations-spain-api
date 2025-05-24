import { Request, Response } from "express";
import { query } from "express-validator";
import { DateTime, Interval } from 'luxon';
import * as Sentry from '@sentry/node'
import { Op } from "sequelize";
import persistedDatabase from "@/services/persisted-database";
import { HistoricFuelStation } from "@/models/db/historic-fuel-station";
import { FuelStation } from "@/models/db/fuel-station";
import { HistoricPriceReturn } from "@/models/historic-price-return";

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
    const historicResult = await HistoricFuelStation.findAll({
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

    let currentPrices: FuelStation | null = null;
    if (req.query.includeCurrentPrices && req.query.includeCurrentPrices != 'false') {
      currentPrices = await FuelStation.findOne({
        where: {
          id: req.query.id
        }
      })
    }

    const formattedHistoric = historicResult.map(e => {
      const values = e.get()
      return {
        stationId: values.station_id,
        stationSignage: values.station_signage,
        biodieselPrice: values.biodiesel_price,
        bioethanolPrice: values.bioethanol_price,
        CNGPrice: values.cng_price,
        LNGPrice: values.lng_price,
        LPGPrice: values.lpg_price,
        gasoilAPrice: values.gasoil_a_price,
        gasoilBPrice: values.gasoil_b_price,
        premiumGasoilPrice: values.premium_gasoil_price,
        gasoline95E10Price: values.gasoline_95_e10_price,
        gasoline95E5Price: values.gasoline_95_e5_price,
        gasoline95E5PremiumPrice: values.gasoline_95_e5_premium_price,
        gasoline98E10Price: values.gasoline_98_e10_price,
        gasoline98E5Price: values.gasoline_98_e5_price,
        hydrogenPrice: values.hydrogen_price,
        adbluePrice: values.adblue_price,
        date: values.date,
      } as HistoricPriceReturn
    })

    if (currentPrices) {
      const values = currentPrices.get()
      formattedHistoric.push({
        stationId: values.id,
        stationSignage: values.signage,
        biodieselPrice: values.biodieselPrice,
        bioethanolPrice: values.bioethanolPrice,
        CNGPrice: values.CNGPrice,
        LNGPrice: values.LNGPrice,
        LPGPrice: values.LPGPrice,
        gasoilAPrice: values.gasoilAPrice,
        gasoilBPrice: values.gasoilBPrice,
        premiumGasoilPrice: values.premiumGasoilPrice,
        gasoline95E10Price: values.gasoline95E10Price,
        gasoline95E5Price: values.gasoline95E5Price,
        gasoline95E5PremiumPrice: values.gasoline95E5PremiumPrice,
        gasoline98E10Price: values.gasoline98E10Price,
        gasoline98E5Price: values.gasoline98E5Price,
        hydrogenPrice: values.hydrogenPrice,
        adbluePrice: values.adblue_price,
        date: DateTime.now().toSQLDate()
      })
    }

    res.json(formattedHistoric)
  } catch (error) {
    console.log(error)
    Sentry.captureException(error)
    res.sendStatus(500)
  }
}