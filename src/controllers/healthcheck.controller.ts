import { NextFunction, Request, Response } from "express";
import { FuelStationsTable } from "@/models/db/FuelStations";
import { logger } from '@/utils';

export const healthcheckController = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const { count: realtimeStations } = await FuelStationsTable.findAndCountAll({ limit: 10 })

    if (realtimeStations > 0) {
      res.status(200).send()
    }
    else {
      res.status(500).send()
    }
  } catch (error) {
    logger.error('Healthcheck failed', { error: error instanceof Error ? error.message : String(error) });
    res.status(500).send()
  }
}
