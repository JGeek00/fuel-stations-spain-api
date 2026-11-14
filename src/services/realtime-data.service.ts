import { CronJob } from "cron";
import { randomUUID } from "crypto";
import { DataProviderApiService } from "./data-provider-api.service";
import { FuelStationsMapper } from "@/mapper";
import { stationRepository } from "@/infrastructure/persistence/StationRepository";
import { municipalitiesRepository } from "@/infrastructure/persistence/MunicipalitiesRepository";
import { logger } from "@/utils/logger";

class RealtimeDataService {
  loadStations = async () => {
    try {
      const result = await DataProviderApiService.getStations();
      if (!result) {
        logger.error("Failed to fetch stations data")
        return
      }

      // Check duplicated ids
      const processedIds: string[] = []
      const duplicatedIds: string[] = []
      result.ListaEESSPrecio.forEach(e => {
        if (!e.IDEESS) return
        if (processedIds.includes(e.IDEESS)) {
          duplicatedIds.push(e.IDEESS)
        }
        else {
          processedIds.push(e.IDEESS)
        }
      })
      if (duplicatedIds.length > 0) {
        logger.warn(`⚠️ Duplicated IDs found: ${duplicatedIds.join(",")}`)
      }

      try {
        // Save new data (the repository restores previous state on failure)
        const stations = FuelStationsMapper.map(result.ListaEESSPrecio).map(e => ({ ...e, id: randomUUID() }))
        await stationRepository.replaceAll(stations, new Date().toISOString())

        logger.info("✅ Realtime data saved successfully")

      } catch (error) {
        logger.warn("⚠️ Restored previous data")
        logger.error(error)
      }

    } catch (error) {
      logger.error(error)
    }
  }

  loadMunicipalities = async () => {
    try {
      const result = await DataProviderApiService.getMunicipalities();
      if (!result) {
        logger.error("Failed to fetch municipalities data")
        return
      }

      var data = JSON.stringify(result)
      data = data.replaceAll("IDMunicipio", "municipalityId")
      data = data.replaceAll("IDProvincia", "provinceId")
      data = data.replaceAll("IDCCAA", "regionId")
      data = data.replaceAll("Municipio", "municipality")
      data = data.replaceAll("Provincia", "province")
      data = data.replaceAll("CCAA", "region")
      let parsed = JSON.parse(data)

      municipalitiesRepository.replaceAll(parsed)

      logger.info("✅ Municipalities saved successfully")
    } catch (error) {
      logger.error(error)
    }
  }

  loadAll = async (): Promise<void> => {
    try {
      await Promise.all([
        this.loadStations(), 
        this.loadMunicipalities()
      ]);
    } catch (error) {
      logger.error("RealtimeDataService.loadAll error:", error);
    }
  }

  registerProgrammedTask = () => {
    // Trigger process on minute 0 and30 of every hour: 0,30 * * * *
    CronJob.from({
      cronTime: process.env.REALTIME_DATA_CRON ?? '0,30 * * * *',
      onTick: this.loadAll,
      start: true,
      timeZone: process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    logger.info('  ⏰ Realtime data cron registered', { cronTime: process.env.REALTIME_DATA_CRON ?? '0,30 * * * *' });
  }
}

export const realtimeDataService = new RealtimeDataService();
