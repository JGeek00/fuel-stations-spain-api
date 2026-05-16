import { CronJob } from "cron";
import { randomUUID } from "crypto";
import { DataProviderApiService } from "../data-provider-api/data-provider-api.service";
import { LastUpdated } from "@/models/db/LastUpdated";
import { FuelStationsMapper } from "@/mapper";
import MunicipalitiesRepository from "@/repository/Municipalities/Municipalities.repository";
import { FuelStationsTable } from "@/models/db/FuelStations";
import { logger } from "@/utils";

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

      // Save previous state in case new insert fails
      const previousStations = await FuelStationsTable.findAll()
      const previousLastUpdated = await LastUpdated.findAll()

      // Erase previous data
      await FuelStationsTable.truncate()
      await LastUpdated.truncate()

      try {
        // Save new data
        await FuelStationsTable.bulkCreate(FuelStationsMapper.map(result.ListaEESSPrecio).map(e => ({ ...e, id: randomUUID() })))

        await LastUpdated.create({
          lastUpdated: new Date()
        })

        logger.info("✅ Realtime data saved successfully")

      } catch (error) {
        // Save previous data (convert model instances to plain objects)
        if (previousStations && previousStations.length > 0) {
          const previousStationsData = previousStations.map(s => s.get({ plain: true }))
          await FuelStationsTable.bulkCreate(previousStationsData)
        }

        if (previousLastUpdated && previousLastUpdated.length > 0) {
          const lastUpdatedData = previousLastUpdated[0].get({ plain: true })
          await LastUpdated.create(lastUpdatedData)
        }

        logger.warn("⚠️ Restored previous data")
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

      MunicipalitiesRepository.data = parsed

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
