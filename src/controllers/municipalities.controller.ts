import { Request, Response } from "express";
import * as Sentry from '@sentry/node';
import MunicipalitiesStore from '@/data/municipalities-store';

export const municipalitiesController = async (req: Request, res: Response): Promise<void> => {
  if (process.env.DISABLE_MUNICIPALITIES == "true") {
    res.status(404).send("Endpoint not found")
    return
  }    

  try {
    let data = MunicipalitiesStore.data
    res.send({
      "municipalities": data
    })
  } catch (error) {
    Sentry.captureException(error)
    res.sendStatus(500)
  }
}