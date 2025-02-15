import { Request, Response } from "express";
import { FuelStation } from "@/models/db/fuel-station";

export const healthcheckController = async (req: Request, res: Response) => {
  try {
    const { count: realtimeStations } = await FuelStation.findAndCountAll({ limit: 10 })

    if (realtimeStations > 0) {
      res.status(200).send()
    }
    else {
      res.status(500).send()
    }
  } catch (error) {
    res.status(500).send()
  }
} 