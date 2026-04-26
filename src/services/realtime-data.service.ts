import { CronJob } from "cron";
import { FuelStation } from "@/models/FuelStation";
import { DataProviderApiService } from "./data-provider-api.service";
import { LastUpdated } from "@/models/LastUpdated";
import { formatStations } from "@/utils/format-stations";
import MunicipalitiesStore from "@/data/municipalities-store";

class RealtimeDataService {
  loadStations = async () => {
    try {
      const result = await DataProviderApiService.getStations();
      if (!result) {
        console.error("Failed to fetch stations data")
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
        console.log(`⚠️ Duplicated IDs found: ${duplicatedIds.join(",")}`)
      }

      // Save previous state in case new insert fails
      const previousStations = await FuelStation.findAll()
      const previousLastUpdated = await LastUpdated.findAll()

      // Erase previous data
      await FuelStation.truncate()
      await LastUpdated.truncate()

      try {
        // Save new data
        await FuelStation.bulkCreate(formatStations(result.ListaEESSPrecio))

        await LastUpdated.create({
          lastUpdated: new Date()
        })

        console.log("✅ Realtime data saved successfully")

      } catch (error) {
        // Save previous data (convert model instances to plain objects)
        if (previousStations && previousStations.length > 0) {
          const previousStationsData = previousStations.map(s => s.get({ plain: true }))
          await FuelStation.bulkCreate(previousStationsData)
        }

        if (previousLastUpdated && previousLastUpdated.length > 0) {
          const lastUpdatedData = previousLastUpdated[0].get({ plain: true })
          await LastUpdated.create(lastUpdatedData)
        }

        console.log("⚠️ Restored previous data")
      }

    } catch (error) {
      console.error(error)
    }
  }

  loadMunicipalities = async () => {
    try {
      const result = await DataProviderApiService.getMunicipalities();
      if (!result) {
        console.error("Failed to fetch municipalities data")
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

      MunicipalitiesStore.data = parsed

      console.log("✅ Municipalities saved successfully")
    } catch (error) {
      console.error(error)
    }
  }

  loadAll = async (): Promise<void> => {
    try {
      await Promise.all([
        this.loadStations(), 
        this.loadMunicipalities()
      ]);
    } catch (error) {
      console.error("RealtimeDataService.loadAll error:", error);
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
  }
}

export const realtimeDataService = new RealtimeDataService();
