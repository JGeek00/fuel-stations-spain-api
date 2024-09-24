import { Request, Response } from "express";
import { FuelStation } from "../models/db/fuel-station";

export const serviceStationsController = async (req: Request, res: Response) => {
  try {
    const results = await FuelStation.findAndCountAll({
      limit: 30
    })
    res.json(results)
  } catch (error) {
    res.sendStatus(500)
  }
}