import axios from "axios"
import { assertEquals } from "typia"
import { FuelStation } from "@/models/db/fuel-station"
import { LastUpdated } from "@/models/db/last-updated"
import { ServiceStationsResult } from "@/models/service-stations-result"
import { parseStringToFloat } from "@/utils/parser"

export const loadStations = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assertEquals<ServiceStationsResult>(result.data)
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
      await FuelStation.bulkCreate(parsedResult.ListaEESSPrecio.map(station => {
        return {
          id: station.IDEESS,
          postalCode: station["C.P."],
          address: station.Dirección,
          openingHours: station.Horario,
          latitude: parseStringToFloat(station.Latitud),
          longitude: parseStringToFloat(station["Longitud (WGS84)"]),
          locality: station.Localidad,
          margin: station.Margen,
          municipio: station.Municipio,
          provincia: station.Provincia,
          referral: station.Remisión,
          signage: station.Rótulo,
          saleType: station["Tipo Venta"],
          percBioEthanol: parseStringToFloat(station["% BioEtanol"]),
          percMethylEster: parseStringToFloat(station["% Éster metílico"]),
          municipalityId: station.IDMunicipio ? parseInt(station.IDMunicipio) : null,
          provinceId: station.IDProvincia ? parseInt(station.IDProvincia) : null,
          regionId: station.IDCCAA ? parseInt(station.IDCCAA) : null,
          biodieselPrice: parseStringToFloat(station["Precio Biodiesel"]),
          bioethanolPrice: parseStringToFloat(station["Precio Bioetanol"]),
          CNGPrice: parseStringToFloat(station["Precio Gas Natural Comprimido"]),
          LNGPrice: parseStringToFloat(station["Precio Gas Natural Licuado"]),
          LPGPrice: parseStringToFloat(station["Precio Gases licuados del petróleo"]),
          gasoilAPrice: parseStringToFloat(station["Precio Gasoleo A"]),
          gasoilBPrice: parseStringToFloat(station["Precio Gasoleo B"]),
          premiumGasoilPrice: parseStringToFloat(station["Precio Gasoleo Premium"]),
          gasoline95E10Price: parseStringToFloat(station["Precio Gasolina 95 E10"]),
          gasoline95E5Price: parseStringToFloat(station["Precio Gasolina 95 E5"]),
          gasoline95E5PremiumPrice: parseStringToFloat(station["Precio Gasolina 95 E5 Premium"]),
          gasoline98E10Price: parseStringToFloat(station["Precio Gasolina 98 E10"]),
          gasoline98E5Price: parseStringToFloat(station["Precio Gasolina 98 E5"]),
          hydrogenPrice: parseStringToFloat(station["Precio Hidrogeno"]),
        }
      }))

      await LastUpdated.create({
        lastUpdated: new Date()
      })

      console.log("✅ Realtime data saved successfully")

    } catch (error) {
      // Save previous data
      await FuelStation.bulkCreate(previousStations as any)
      await LastUpdated.create(previousLastUpdated[0] as any)

      console.log("⚠️ Restored previous data")
    }

  } catch (error) {
    console.error(error)
  }
}