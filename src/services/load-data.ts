import axios from "axios"
import { assertEquals } from "typia";
import { ServiceStationsResult } from "@/models/service-stations-result";
import { FuelStation } from "@/models/db/fuel-station";
import { formatCurrentDate } from "@/utils/datetime-formatter";
import { LastUpdated } from "@/models/db/last-updated";
import { parseStringToFloat } from "@/utils/parser";
import { startCronJob } from "@/utils/cron";
import MunicipalitiesStore from "@/data/municipalities-store";

export const loadDataOnStart = async () => {
  console.log(`Fetch data on API start: ${formatCurrentDate()}`)

  await loadData()

  startCronJob()
}

export const loadDataProgrammed = () => {
  console.log(`🕒 Starting programmed load: ${formatCurrentDate()}`)
  loadData()
}

const loadData = async() => {
  await Promise.all([
    loadStations(),
    loadMunicipalities()
  ])
}

const loadStations = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assertEquals<ServiceStationsResult>(result.data)
    if (!parsedResult.ListaEESSPrecio) {
      throw new Error("ListaEESSPrecio is null")
    }

    // Erase previous data
    await FuelStation.truncate()
    await LastUpdated.truncate()

    // Save new data
    await FuelStation.bulkCreate(parsedResult.ListaEESSPrecio?.map(station => {
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

    console.log("✅ Data saved successfully")
  } catch (error) {
    console.error(error)
  }
}

const loadMunicipalities = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/Listados/Municipios", {
      headers: {
        "Content-Type": "application/json"
      }
    })

    var data = JSON.stringify(result.data)
    data = data.replace("IDMunicipio", "municipalityId")
    data = data.replace("IDProvincia", "provinceId")
    data = data.replace("IDCCAA", "regionId")
    data = data.replace("Municipio", "municipality")
    data = data.replace("CCAA", "region")
    let parsed = JSON.parse(data)

    MunicipalitiesStore.data = parsed

    console.log("✅ Municipalities saved successfully")
  } catch (error) {
    console.error(error)
  }
}