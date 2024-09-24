import axios from "axios"
import { assertEquals } from "typia";
import { ServiceStationsResult } from "@/models/service-stations-result";
import { FuelStation } from "@/models/db/fuel-station";
import { formatCurrentDate } from "@/utils/datetime-formatter";
import { LastUpdated } from "@/models/db/last-updated";
import { parseStringToFloat } from "@/utils/parser";

export const loadDataOnStart = () => {
  console.log(`Fetch data on start: ${formatCurrentDate()}`)
  loadData()
}

export const loadData = async () => {
  try {
    const result = await axios.get("https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/")
    const parsedResult = assertEquals<ServiceStationsResult>(result.data)
    if (!parsedResult.ListaEESSPrecio) {
      throw new Error("ListaEESSPrecio is null")
    }
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
        municipalityId: station.IDMunicipio,
        provinceId: station.IDProvincia,
        regionId: station.IDCCAA,
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