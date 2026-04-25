import axios from "axios"
import { assert } from "typia"
import { FuelStation } from "@/models/fuel-station"
import { LastUpdated } from "@/models/last-updated"
import { ServiceStationsResult } from "@/interfaces/service-stations-result"
import { formatStations } from "@/utils/format-stations"

export const loadStations = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assert<ServiceStationsResult>(result.data)
    if (!parsedResult.ListaEESSPrecio) {
      throw new Error("ListaEESSPrecio is null")
    }

    // Check duplicated ids
    const processedIds: string[] = []
    const duplicatedIds: string[] = []
    parsedResult.ListaEESSPrecio.forEach(e => {
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
      await FuelStation.bulkCreate(formatStations(parsedResult.ListaEESSPrecio))

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