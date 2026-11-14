import { NextFunction, Request, Response } from "express";
import { stationRepository } from '@/infrastructure/persistence/StationRepository';
import { logger } from '@/shared/utils/logger';

export const healthcheckController = async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
  try {
    const realtimeStations = await stationRepository.count()

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
