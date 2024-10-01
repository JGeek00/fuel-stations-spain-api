import MunicipalitiesStore from '@/data/municipalities-store';
import { Request, Response } from "express";

export const municipalitiesController = async (req: Request, res: Response) => {
  try {
    let data = MunicipalitiesStore.data
    res.send({
      "municipalities": data
    })
  } catch (error) {
    console.log(error)
    res.sendStatus(500)
  }
}